from typing import Dict, List
from langchain.embeddings import SagemakerEndpointEmbeddings
from langchain.embeddings.openai import OpenAIEmbeddings
from langchain.llms import OpenAI
from langchain.chat_models import ChatOpenAI
from langchain.embeddings.sagemaker_endpoint import EmbeddingsContentHandler
from langchain import PromptTemplate, SagemakerEndpoint
from langchain.llms.sagemaker_endpoint import LLMContentHandler
from langchain.chains.question_answering import load_qa_chain
from langchain.chains import LLMChain,ConversationalRetrievalChain,ConversationChain
from langchain.vectorstores import OpenSearchVectorSearch
from langchain.text_splitter import CharacterTextSplitter,RecursiveCharacterTextSplitter
from langchain.memory import ConversationBufferMemory

from requests_aws4auth import AWS4Auth
from opensearchpy import OpenSearch, RequestsHttpConnection
import math
import os
from io import BytesIO
import boto3
from botocore.exceptions import ClientError
import tempfile
import json
import time
import base64

BULK_SIZE = 500
s3 = boto3.client('s3')
dynamodb = boto3.client('dynamodb')
UPLOADS_BUCKET = os.environ.get('UPLOADS_BUCKET')
DOC_INDEX_TABLE= os.environ.get('DOC_INDEX_TABLE')
embedding_endpoint = os.environ['embedding_endpoint']
llm_endpoint = os.environ['llm_endpoint']
region = os.environ['region']
opensearch_endpoint = os.environ['opensearch_endpoint']
headers = {
                "Access-Control-Allow-Headers" :  "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "OPTIONS,GET,PUT,POST,DELETE"
                }

class EmbContentHandler(EmbeddingsContentHandler):
    content_type = "application/json"
    accepts = "application/json"

    def transform_input(self, inputs: list[str], model_kwargs: Dict) -> bytes:
        input_str = json.dumps({"inputs": inputs, **model_kwargs})
        return input_str.encode('utf-8')

    def transform_output(self, output: bytes) -> List[List[float]]:
        response_json = json.loads(output.read().decode("utf-8"))
        return response_json["vectors"]
    
class llmContentHandler(LLMContentHandler):
    content_type = "application/json"
    accepts = "application/json"

    def transform_input(self, prompt: str, model_kwargs: Dict) -> bytes:
        input_str = json.dumps({'prompt': prompt, **model_kwargs})
        return input_str.encode('utf-8')
    
    def transform_output(self, output: bytes) -> str:
        response_json = json.loads(output.read().decode("utf-8"))
        return response_json["response"]


def download_s3(bucket, filename):
    try:
        response = s3.get_object(Bucket=bucket, Key=filename)
        content = response['Body'].read().decode('utf-8')  # Decode the file contents
        # print(content)  # Or save the file to disk with open('file.txt', 'wb').write(response['Body'].read())
        return content
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
            endpoint_name=embedding_endpoint, 
            region_name=region, 
            content_handler = EmbContentHandler()
        )
    if embedding_model == 'all-minilm-l6-v2':
       embedding = default
       
    elif embedding_model == 'openai':
        embedding = OpenAIEmbeddings()
    else:
        return default

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
            endpoint_name=embedding_endpoint, 
            region_name=region, 
            content_handler = EmbContentHandler()
        )
    if embedding_model == 'all-minilm-l6-v2':
        embedding = default
    elif embedding_model == 'openai':
        embedding = OpenAIEmbeddings()

    return OpenSearchVectorSearch.from_texts(texts=texts, embedding=embedding, bulk_size=bulk_size,
                                http_auth = awsauth,
                                use_ssl = True,
                                    verify_certs = True,
                            connection_class = RequestsHttpConnection,
                                    opensearch_url=f"{opensearch_endpoint}:443",
                                    engine="faiss", space_type="innerproduct",
                                                 ef_construction=256, m=48)

def handler(event, context):
    print(event)
    if event.get('resource')  == '/build':
        task = 'build'
    else:
        task = event['task']
    print(f'embedding_endpoint:{embedding_endpoint}')
    print(f'llm_endpoint:{llm_endpoint}')
    print(f'opensearch_endpoint:{opensearch_endpoint}')
    print(f'region:{region}')

    if task == 'embedding': 
        query = event['query']
        embcontent_handler = EmbContentHandler()
        sg_embeddings = SagemakerEndpointEmbeddings(
            endpoint_name=embedding_endpoint, 
            region_name=region, 
            content_handler=embcontent_handler
        )
        doc_results = sg_embeddings.embed_documents(query)
        print(doc_results)
        return {
                'statusCode': 200,
                'body': json.dumps(
                        {
                                'result': doc_results,
                            }
                        )
            }
    elif task == 'chat':
        messagelist = event['messages']
        model_params = event['params']
        embedding_model = model_params.get('embedding_model_name').lower()
        print(model_params)
        chat_history = []
        queries =  [ msg['content'] for msg in messagelist[:-1] if msg['role'] == 'user' ]
        answers =  [ msg['content'] for msg in messagelist[:-1] if msg['role'] != 'user' ]
        
        for i in range(min(len(answers),len(queries))):
            chat_history.append((queries[i],answers[i]))
        print(f'chat_history:{chat_history}')
        
        prompt = messagelist[-1]['content']
        if model_params.get('model_name') == 'chatglm-6b':
            llmcontent_handler = llmContentHandler()
            llm=SagemakerEndpoint(
                    endpoint_name=llm_endpoint, 
                    region_name=region, 
                    model_kwargs={"temperature":model_params['temperature']},
                    content_handler=llmcontent_handler
                )
        elif model_params.get('model_name') == 'gpt-3.5-turbo' :
            llm=ChatOpenAI(temperature=model_params['temperature'])
        
        index_name = model_params.get('file_idx')
        if not index_name:
            print ('no index found, use default llm chain')

        ##如果是QA    
        if model_params.get('use_qa') and index_name:
            prompt_template_zh = """请根据以下的内容用中文回答问题,
            
            {context}
            
            问题: {question}
            答案:"""
            PROMPT_zh = PromptTemplate(
                            template=prompt_template_zh, input_variables=["context", "question"])
            docsearch_client = get_embedding_docsearch(index_name,embedding_model)

            condense_prompt_template_zh = """给定以下对话记录和一个后续问题，将后续问题改为一个独立的问题。使用中文
                        
                        对话记录:
                        {chat_history}
                        后续问题: {question}
                        独立问题:
                        """
            CON_PROMPT_zh = PromptTemplate.from_template(condense_prompt_template_zh)

            chain = ConversationalRetrievalChain.from_llm(llm=llm,
                                                          verbose=True,
                                                          retriever=docsearch_client.as_retriever(),
                                                          condense_question_prompt=CON_PROMPT_zh,
                                                           combine_docs_chain_kwargs={'prompt':PROMPT_zh}
                                                          )
            chain_results = chain.run({ "question": prompt,'chat_history':chat_history})

        ##如果是闲聊
        else: 

            chat_template_zh = """
                以下是人类和AI之间的对话，如果AI不知道问题的答案,它会如实地说它不知道。
            当前对话:
            ```{history}```
            人类: {input}
            AI:"""
            Chat_PROMPT = PromptTemplate(input_variables=["history", "input"], template=chat_template_zh)

            memory = ConversationBufferMemory()     
            for msg in messagelist[:-1]:
                if msg['role'] == 'user':
                    memory.chat_memory.add_user_message(msg['content'])
                else:
                    memory.chat_memory.add_ai_message(msg['content'])
            print(f'memory:{memory.load_memory_variables({})}')
            chain = ConversationChain(llm=llm,memory=memory,verbose=True,prompt=Chat_PROMPT)
            chain_results = chain.run(prompt)


        print(chain_results)
        return {
                'statusCode': 200,
                'body': json.dumps(
                        {
                                'result': chain_results,
                            }
                    )
            }
    elif task == 'build_idx':
        # body = json.loads(event['body'])
        print(event)
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
                return {
                'statusCode': 400,
                'body':'fetch file from s3 error',
                'headers': headers,
            }
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
            
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'result': f'Build index for [{object}] with [{embedding_model}] by user:[{username}] success' } )
        }
      
    elif task == 'qna':
        return {
                'statusCode': 200
                }


    

