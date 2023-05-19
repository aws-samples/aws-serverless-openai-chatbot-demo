import json
import boto3
import os

def lambda_handler(event, context):

    glue = boto3.client('glue')

    bucket = event['Records'][0]['s3']['bucket']['name']
    object_key = event['Records'][0]['s3']['object']['key']
    
    print("**** in lambda : " + bucket)
    print("**** in lambda : " + object_key)
 
    
    
    event = {'params':{'embedding_model_name':'paraphrase-mpnet-base-v2'},
                 'username':'s3notifications',
                 'bucket':bucket,
                 'object':object_key
                 }
    glue.start_job_run(JobName=os.environ.get('glue_jobname'), Arguments={"--event": json.dumps(event)})

    return {
        'statusCode': 200,
        'body': json.dumps('Successful ')
    }
