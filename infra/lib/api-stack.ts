import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as apigwv2Authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as iam from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';
const TABLE_NAME = 'SinkBoard';
const ANTHROPIC_KEY_PARAM = '/sinkboard/anthropic-api-key';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ApiStackProps extends cdk.StackProps {
  userPool: cognito.IUserPool;
  userPoolClient: cognito.IUserPoolClient;
}

export class ApiStack extends cdk.Stack {
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // DynamoDB table
    const table = new dynamodb.Table(this, 'Table', {
      tableName: TABLE_NAME,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // HTTP API
    const httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: 'SinkBoard',
      corsPreflight: {
        allowOrigins: [
          'https://sinkboard.stridetwo.com',
          'http://localhost:5173',
        ],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.DELETE,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Authorization', 'Content-Type'],
        maxAge: cdk.Duration.hours(1),
      },
    });

    // Cognito JWT authorizer
    const authorizer = new apigwv2Authorizers.HttpJwtAuthorizer('CognitoAuthorizer', `https://cognito-idp.${this.region}.amazonaws.com/${props.userPool.userPoolId}`, {
      jwtAudience: [props.userPoolClient.userPoolClientId],
    });

    // Shared Lambda props
    const handlersDir = path.join(__dirname, '..', '..', 'backend', 'src', 'handlers');

    const sharedLambdaProps: Partial<lambdaNode.NodejsFunctionProps> = {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: {
        TABLE_NAME,
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: {
        format: lambdaNode.OutputFormat.ESM,
        target: 'node20',
        sourceMap: true,
        mainFields: ['module', 'main'],
        // Needed for ESM bundling with esbuild
        banner: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
      },
    };

    // Helper to create a Lambda + route
    const addRoute = (
      id: string,
      handlerFile: string,
      method: apigwv2.HttpMethod,
      routePath: string,
      overrides?: Partial<lambdaNode.NodejsFunctionProps>,
    ): lambdaNode.NodejsFunction => {
      const fn = new lambdaNode.NodejsFunction(this, id, {
        ...sharedLambdaProps,
        ...overrides,
        entry: path.join(handlersDir, handlerFile),
        handler: 'handler',
        environment: {
          ...sharedLambdaProps.environment,
          ...overrides?.environment,
        },
      });

      table.grantReadWriteData(fn);

      httpApi.addRoutes({
        path: routePath,
        methods: [method],
        integration: new apigwv2Integrations.HttpLambdaIntegration(`${id}Integration`, fn),
        authorizer,
      });

      return fn;
    };

    // Lambda functions
    addRoute('GetMe', 'get-me.ts', apigwv2.HttpMethod.GET, '/me');
    addRoute('GetTasks', 'get-tasks.ts', apigwv2.HttpMethod.GET, '/tasks');
    addRoute('CreateTask', 'create-task.ts', apigwv2.HttpMethod.POST, '/tasks');
    addRoute('CompleteTask', 'complete-task.ts', apigwv2.HttpMethod.PUT, '/tasks/{id}/complete');
    addRoute('KrakenTook', 'kraken-took.ts', apigwv2.HttpMethod.POST, '/tasks/{id}/kraken');

    // submit-update gets extra timeout and SSM access for AI calls
    const submitUpdateFn = addRoute(
      'SubmitUpdate',
      'submit-update.ts',
      apigwv2.HttpMethod.POST,
      '/tasks/{id}/updates',
      {
        timeout: cdk.Duration.seconds(30),
        environment: {
          TABLE_NAME,
          ANTHROPIC_KEY_PARAM,
          NODE_OPTIONS: '--enable-source-maps',
        },
      },
    );

    // Grant SSM read for the Anthropic API key
    submitUpdateFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter${ANTHROPIC_KEY_PARAM}`,
      ],
    }));

    this.apiUrl = httpApi.apiEndpoint;

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: httpApi.apiEndpoint,
      exportName: 'SinkBoard-ApiUrl',
    });
  }
}
