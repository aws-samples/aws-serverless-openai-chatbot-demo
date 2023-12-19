// import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
// import * as appscaling from 'aws-cdk-lib/aws-applicationautoscaling';
// import {v4 as uuidv4} from 'uuid';

export function addAutoScaling(fn,minCapacity=1,maxCapacity=100){
    const alias = fn.addAlias('prod');

    // Create AutoScaling target
    const as = alias.addAutoScaling({ minCapacity:minCapacity, maxCapacity: maxCapacity });
    
    // Configure Target Tracking
    as.scaleOnUtilization({
      utilizationTarget: 0.7,
      minCapacity: minCapacity,
      maxCapacity:maxCapacity,
    });
    return alias
}
