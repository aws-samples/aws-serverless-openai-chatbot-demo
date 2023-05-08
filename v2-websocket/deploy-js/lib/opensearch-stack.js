import { CfnOutput, NestedStack,RemovalPolicy }  from 'aws-cdk-lib';
import {EngineVersion,Domain} from 'aws-cdk-lib/aws-opensearchservice';
import * as ec2 from 'aws-cdk-lib/aws-ec2';


export class OpenSearchStack extends NestedStack {
    domainEndpoint;

/**
   *
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
constructor(scope, id, props) {
    super(scope, id, props);


    const devDomain = new Domain(this, 'Domain', {
        version: EngineVersion.OPENSEARCH_2_3,
        removalPolicy: RemovalPolicy.DESTROY,
        vpc:props.vpc,
        subnets:props.subnets,
        securityGroups:props.securityGroups,
        // enableVersionUpgrade: true,
        // useUnsignedBasicAuth: true,
        // zoneAwareness: {
        //     enabled: true,
        //   },
          capacity: {
            dataNodes: 1,
          },
        ebs: {
        volumeSize: 100,
        volumeType: ec2.EbsDeviceVolumeType.GENERAL_PURPOSE_SSD,
        },
      });
      const masterUserPassword = devDomain.masterUserPassword;
      const domainEndpoint = devDomain.domainEndpoint;
    //   console.log(`masterUserPassword:${masterUserPassword}`);
    this.domainEndpoint = domainEndpoint;
      new CfnOutput(this,'opensearch endpoint',{value:domainEndpoint});
      
    //   devDomain.grantIndexWrite('app-search', props.fn);
    //   devDomain.grantPathRead('app-search/_search', props.fn);


}
}