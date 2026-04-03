import * as cdk from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import type { Construct } from 'constructs';

export class DnsStack extends cdk.Stack {
  public readonly hostedZone: route53.IHostedZone;
  public readonly certificate: acm.ICertificate;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    // Look up the existing hosted zone for stridetwo.com
    this.hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: 'Z0860256QI0URAT9MPDH',
      zoneName: 'stridetwo.com',
    });

    // ACM certificate for sinkboard.stridetwo.com
    // This stack is deployed in us-east-1 so the cert works with CloudFront
    this.certificate = new acm.Certificate(this, 'Certificate', {
      domainName: 'sinkboard.stridetwo.com',
      validation: acm.CertificateValidation.fromDns(this.hostedZone),
    });

    new cdk.CfnOutput(this, 'CertificateArn', {
      value: this.certificate.certificateArn,
      exportName: 'SinkBoard-CertificateArn',
    });
  }
}
