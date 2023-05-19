#!/usr/bin/env python
# coding: utf-8
from opensearchpy import RequestsHttpConnection
import boto3
from awsglue.utils import getResolvedOptions
import sys,json
from typing import Dict, List
from langchain.embeddings import SagemakerEndpointEmbeddings
from langchain.embeddings.openai import OpenAIEmbeddings

from langchain.embeddings.sagemaker_endpoint import EmbeddingsContentHandler

from langchain.vectorstores import OpenSearchVectorSearch
from langchain.text_splitter import RecursiveCharacterTextSplitter
from requests_aws4auth import AWS4Auth
from PyPDF2 import PdfReader
import math,os



BULK_SIZE = 500
s3 = boto3.client('s3')
dynamodb = boto3.client('dynamodb')
args = getResolvedOptions(sys.argv, ['event','UPLOADS_BUCKET','DOC_INDEX_TABLE',
                                     'opensearch_endpoint','embedding_endpoint_all_minilm','embedding_endpoint_paraphrase',
                                     'region','llm_endpoint','OPENAI_API_KEY',
                                     ])


event = args['event']
os.environ['OPENAI_API_KEY'] =  args['OPENAI_API_KEY']
UPLOADS_BUCKET = args['UPLOADS_BUCKET']
DOC_INDEX_TABLE= args['DOC_INDEX_TABLE']
embedding_endpoint_all_minilm =args['embedding_endpoint_all_minilm']
embedding_endpoint_paraphrase =args['embedding_endpoint_paraphrase']

llm_endpoint =args['llm_endpoint']
region =args['region']
opensearch_endpoint =args['opensearch_endpoint']

class EmbContentHandler(EmbeddingsContentHandler):
    content_type = "application/json"
    accepts = "application/json"

    def transform_input(self, inputs: list[str], model_kwargs: Dict) -> bytes:
        input_str = json.dumps({"inputs": inputs, **model_kwargs})
        return input_str.encode('utf-8')

    def transform_output(self, output: bytes) -> List[List[float]]:
        response_json = json.loads(output.read().decode("utf-8"))
        return response_json["vectors"]
    
def process_pdf_file(reader):
    raw_text = ''
    for i, page in enumerate(reader.pages):
        text = page.extract_text()
        if text:
            raw_text += text
    return raw_text

def download_s3(bucket, filename):
    _, ext = os.path.splitext(filename.lstrip('/'))
    if ext == '.txt':
        try:
            response = s3.get_object(Bucket=bucket, Key=filename)
            content = response['Body'].read().decode('utf-8')  # Decode the file contents
            # print(content)  # Or save the file to disk with open('file.txt', 'wb').write(response['Body'].read())
            return content
        except Exception as e:
            print(f"There was an error downloading the file Exception: {str(e)}")
            return None
    if ext == '.pdf':
        try:
            os.makedirs('/tmp', exist_ok=True)
            tmpfile = filename.split('/')[-1]
            s3.download_file(bucket, filename, tmpfile)
            reader = PdfReader(tmpfile)
            return process_pdf_file(reader)
        except Exception as e:
            print(f"There was an error downloading the file Exception: {str(e)}")
            return None


        

def put_idx_to_ddb(filename,username,index_name,embedding_model):
    try:
        dynamodb.put_item(
            Item={
                'filename':{
                    'S':filename,
                },
                'username':{
                    'S':username,
                },
                'index_name':{
                    'S':index_name,
                },
                'embedding_model':{
                    'S':embedding_model,
                }
            },
            TableName = DOC_INDEX_TABLE,
        )
        print(f"Put filename:{filename} with embedding:{embedding_model} index_name:{index_name} by user:{username} to ddb success")
        return True
    except Exception as e:
        print(f"There was an error put filename:{filename} with embedding:{embedding_model} index_name:{index_name} to ddb: {str(e)}")
        return False 


def query_idx_from_ddb(filename,username,embedding_model):
    try:
        response = dynamodb.query(
            TableName=DOC_INDEX_TABLE,
            ExpressionAttributeValues={
                ':v1': {
                    'S': filename,
                },
                ':v2': {
                    'S': username,
                },
                ':v3': {
                    'S': embedding_model,
                },
            },
            KeyConditionExpression='filename = :v1 and username = :v2',
            ExpressionAttributeNames={"#e":"embedding_model"},
            FilterExpression='#e = :v3',
            ProjectionExpression='index_name'
        )
        if len(response['Items']):
            index_name = response['Items'][0]['index_name']['S'] 
        else:
            index_name = ''
        print (f"query filename:{filename} with embedding:{embedding_model} index_name:{index_name} from ddb")
        return index_name
    
    except Exception as e:
        print(f"There was an error an error query filename:{filename} index from ddb: {str(e)}")
        return ''

def get_idx_from_ddb(filename,embedding_model):
    try:
        response = dynamodb.get_item(
            Key={
            'filename':{
            'S':filename,
            },
            'embedding_model':{
            'S':embedding_model,
            },
            },
            TableName = DOC_INDEX_TABLE,
        )
        index_name = ''
        if response.get('Item'):
            index_name = response['Item']['index_name']['S']
            print (f"Get filename:{filename} with index_name:{index_name} from ddb")
        return index_name
    except Exception as e:
        print(f"There was an error get filename:{filename} with embedding:{embedding_model} index from ddb: {str(e)}")
        return ''


 
def build_index(raw_text):
    text_splitter = RecursiveCharacterTextSplitter(        
        chunk_size = 500,
        chunk_overlap  = 100,
        length_function = len,
    )
    texts = text_splitter.split_text(raw_text)
    print(f'-----samples----:\n{texts[:1]}')
    return texts

def get_embedding_docsearch(index_name,embedding_model):
    credentials = boto3.Session().get_credentials()
    awsauth = AWS4Auth(credentials.access_key, credentials.secret_key, region, 'es', session_token=credentials.token)
    default =   SagemakerEndpointEmbeddings(
            endpoint_name=embedding_endpoint_paraphrase, 
            region_name=region, 
            content_handler = EmbContentHandler()
        )
    if embedding_model == 'all-minilm-l6-v2':
        embedding = SagemakerEndpointEmbeddings(
            endpoint_name=embedding_endpoint_all_minilm, 
            region_name=region, 
            content_handler = EmbContentHandler()
        )
    elif embedding_model == 'paraphrase-mpnet-base-v2':
        embedding = default
    elif embedding_model == 'openai':
        embedding = OpenAIEmbeddings()
    else:
        embedding = default

    return OpenSearchVectorSearch(index_name=index_name,
                                        embedding_function=embedding, 
                                               http_auth = awsauth,
                                                use_ssl = True,
                                                    verify_certs = True,
                                            connection_class = RequestsHttpConnection,
                                                  opensearch_url=f"{opensearch_endpoint}:443",
                                                engine="faiss", space_type="innerproduct",
                                                 ef_construction=256, m=48)


def create_embedding_docsearch(texts,embedding_model,bulk_size):
    credentials = boto3.Session().get_credentials()
    awsauth = AWS4Auth(credentials.access_key, credentials.secret_key, region, 'es', session_token=credentials.token)
    default =   SagemakerEndpointEmbeddings(
            endpoint_name=embedding_endpoint_paraphrase, 
            region_name=region, 
            content_handler = EmbContentHandler()
        )
    if embedding_model == 'all-minilm-l6-v2':
        embedding = SagemakerEndpointEmbeddings(
            endpoint_name=embedding_endpoint_all_minilm, 
            region_name=region, 
            content_handler = EmbContentHandler()
        )
    elif embedding_model == 'paraphrase-mpnet-base-v2':
        embedding = default
    elif embedding_model == 'openai':
        embedding = OpenAIEmbeddings()
    else:
        embedding = default

    return OpenSearchVectorSearch.from_texts(texts=texts, embedding=embedding, bulk_size=bulk_size,
                                http_auth = awsauth,
                                use_ssl = True,
                                    verify_certs = True,
                            connection_class = RequestsHttpConnection,
                                    opensearch_url=f"{opensearch_endpoint}:443",
                                    engine="faiss", space_type="innerproduct",
                                                 ef_construction=256, m=48)


def build_job(event):
    print(event)
    event = json.loads(event)
    username = event['username']
    bucket = event['bucket']
    object = event['object']
    model_params = event['params']
    embedding_model = model_params.get('embedding_model_name').lower()
    texts = []
    #check if it is already built
    idx_name = get_idx_from_ddb(object,embedding_model)
    if idx_name == '':
        raw_text = download_s3(bucket,object)
        if not raw_text:
            raise Exception('fetch file from s3 error')
        texts = build_index(raw_text)
        bulks = math.ceil(len(texts)/BULK_SIZE)
        docsearch_client = None
        all_docsearch_client = get_embedding_docsearch(index_name=f'all_docs_idx_{embedding_model}',
                                                        embedding_model=embedding_model)
        index_name = ''
        for i in range(bulks):
            print(f'building bulks:[{i}]')
            texts_chunck = texts[i*BULK_SIZE:(i+1)*BULK_SIZE]
            if i == 0:
                docsearch_client = create_embedding_docsearch(texts=texts_chunck,embedding_model=embedding_model,bulk_size=BULK_SIZE)
                index_name = docsearch_client.index_name
            else:
                docsearch_client = get_embedding_docsearch(index_name=index_name,
                                                        embedding_model=embedding_model)
                docsearch_client.add_texts(texts=texts_chunck, bulk_size=BULK_SIZE)
            #add docs to all doc idx
            all_docsearch_client.add_texts(texts=texts_chunck, bulk_size=BULK_SIZE)

        put_idx_to_ddb(filename=object,username=username,
                    index_name=docsearch_client.index_name,
                        embedding_model=embedding_model)
        put_idx_to_ddb(filename='all_docs_idx',username=username,
                    index_name=all_docsearch_client.index_name,
                        embedding_model=embedding_model)

build_job(event)