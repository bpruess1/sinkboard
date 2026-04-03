import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import type { Construct } from 'constructs';

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.IUserPool;
  public readonly userPoolClient: cognito.IUserPoolClient;
  public readonly userPoolDomain: cognito.UserPoolDomain;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    // Read Google OAuth credentials from SSM
    const googleClientId = ssm.StringParameter.valueForStringParameter(
      this,
      '/sinkboard/google-client-id',
    );

    // Cognito User Pool
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'SinkBoard',
      selfSignUpEnabled: false, // Users sign in via Google only
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    this.userPool = userPool;

    // Google identity provider
    const googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleProvider', {
      userPool,
      clientId: googleClientId,
      clientSecret: ssm.StringParameter.valueForStringParameter(this, '/sinkboard/google-client-secret-plain'),
      scopes: ['openid', 'email', 'profile'],
      attributeMapping: {
        email: cognito.ProviderAttribute.GOOGLE_EMAIL,
        givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
        familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
        profilePicture: cognito.ProviderAttribute.GOOGLE_PICTURE,
      },
    });

    // User Pool Domain (Cognito hosted UI prefix)
    this.userPoolDomain = userPool.addDomain('Domain', {
      cognitoDomain: { domainPrefix: 'sinkboard-auth' },
    });

    // User Pool Client
    const userPoolClient = userPool.addClient('AppClient', {
      userPoolClientName: 'SinkBoardWeb',
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          'http://localhost:5173/auth/callback',
          'https://sinkboard.stridetwo.com/auth/callback',
        ],
        logoutUrls: [
          'http://localhost:5173/',
          'https://sinkboard.stridetwo.com/',
        ],
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.GOOGLE,
      ],
    });
    // Ensure the Google provider is created before the client
    userPoolClient.node.addDependency(googleProvider);
    this.userPoolClient = userPoolClient;

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      exportName: 'SinkBoard-UserPoolId',
    });
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      exportName: 'SinkBoard-UserPoolClientId',
    });
    new cdk.CfnOutput(this, 'UserPoolDomain', {
      value: this.userPoolDomain.domainName,
      exportName: 'SinkBoard-UserPoolDomain',
    });
  }
}
