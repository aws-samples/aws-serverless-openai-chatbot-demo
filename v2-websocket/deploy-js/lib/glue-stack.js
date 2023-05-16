import * as glue from  '@aws-cdk/aws-glue-alpha';
import { NestedStack,Duration, CfnOutput }  from 'aws-cdk-lib';
import * as iam from "aws-cdk-lib/aws-iam";
import * as dotenv from "dotenv";
dotenv.config();
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class GlueStack extends NestedStack {

    jobArn = '';
    jobName = '';
    /**
     *
     * @param {Construct} scope
     * @param {string} id
     * @param {StackProps=} props
     */
    constructor(scope, id, props) {
      super(scope, id, props);


      const connection = new glue.Connection(this, 'GlueJobConnection', {
        type: glue.ConnectionType.NETWORK,
        vpc: props.vpc,
        securityGroups: props.securityGroups,
        subnet:props.subnets[0],
      });


      const job = new glue.Job(this, 'chatbot-from-s3-to-aos',{
            executable: glue.JobExecutable.pythonShell({
            glueVersion: glue.GlueVersion.V1_0,
            pythonVersion: glue.PythonVersion.THREE_NINE,
            script: glue.Code.fromAsset(path.join(__dirname, './../../server/glue_job/doc_build_job.py')),
          }),
          // jobName:'chatbot-from-s3-to-aos',
          connections:[connection],
          maxCapacity:1,
          defaultArguments:{
              '--opensearch_endpoint':props.opensearch_endpoint,
              '--region':props.region,
              '--embedding_endpoint':process.env.embedding_endpoint,
              '--UPLOADS_BUCKET':process.env.UPLOADS_BUCKET,
              '--llm_endpoint':process.env.llm_endpoint,
              '--DOC_INDEX_TABLE':props.table,
              '--OPENAI_API_KEY': process.env.OPENAI_API_KEY,
              '--additional-python-modules':'awswrangler==3.1.1,gremlinpython==3.6.3,langchain==0.0.157,opensearch-py==2.2.0,tiktoken==0.3.3',


          }
      })
      job.role.addToPrincipalPolicy(
        new iam.PolicyStatement({
              actions: [ 
                "sagemaker:InvokeEndpointAsync",
                "sagemaker:InvokeEndpoint",
                "s3:List*",
                "s3:Put*",
                "s3:Get*",
                "es:*",
                ],
              effect: iam.Effect.ALLOW,
              resources: ['*'],
              })
      )
      this.jobArn = job.jobArn;
      this.jobName = job.jobName;
    
    }

}