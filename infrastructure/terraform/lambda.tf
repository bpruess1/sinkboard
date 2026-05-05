# --------------- IAM Role for Lambda ---------------

resource "aws_iam_role" "lambda_execution" {
  name = "sink-board-lambda-execution-${var.environment}"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_dynamodb" {
  name = "dynamodb-access"
  role = aws_iam_role.lambda_execution.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.tasks.arn,
          "${aws_dynamodb_table.tasks.arn}/index/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# --------------- Lambda Functions ---------------

resource "aws_lambda_function" "get_tasks" {
  filename         = "../../backend/dist/lambda.zip"
  function_name    = "sink-board-get-tasks-${var.environment}"
  role            = aws_iam_role.lambda_execution.arn
  handler         = "handlers/get-tasks.handler"
  source_code_hash = filebase64sha256("../../backend/dist/lambda.zip")
  runtime         = "nodejs20.x"
  timeout         = 30
  memory_size     = 512
  
  environment {
    variables = {
      TABLE_NAME  = aws_dynamodb_table.tasks.name
      JWT_SECRET  = var.jwt_secret
      SENTRY_DSN  = var.sentry_dsn
      ENVIRONMENT = var.environment
    }
  }
}

resource "aws_lambda_function" "create_task" {
  filename         = "../../backend/dist/lambda.zip"
  function_name    = "sink-board-create-task-${var.environment}"
  role            = aws_iam_role.lambda_execution.arn
  handler         = "handlers/tasks.createTask"
  source_code_hash = filebase64sha256("../../backend/dist/lambda.zip")
  runtime         = "nodejs20.x"
  timeout         = 30
  memory_size     = 512
  
  environment {
    variables = {
      TABLE_NAME  = aws_dynamodb_table.tasks.name
      JWT_SECRET  = var.jwt_secret
      SENTRY_DSN  = var.sentry_dsn
      ENVIRONMENT = var.environment
    }
  }
}

# --------------- API Gateway ---------------

resource "aws_apigatewayv2_api" "main" {
  name          = "sink-board-api-${var.environment}"
  protocol_type = "HTTP"
  
  cors_configuration {
    allow_origins = var.environment == "production" ? [
      "https://${aws_s3_bucket.frontend.bucket}.s3-website-${var.aws_region}.amazonaws.com"
    ] : ["*"]
    allow_methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    allow_headers = ["content-type", "authorization"]
    max_age       = 300
  }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true
  
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
    })
  }
}

resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/sink-board-${var.environment}"
  retention_in_days = 7
}

# --------------- API Gateway Integrations ---------------

resource "aws_apigatewayv2_integration" "get_tasks" {
  api_id             = aws_apigatewayv2_api.main.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.get_tasks.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "get_tasks" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /tasks"
  target    = "integrations/${aws_apigatewayv2_integration.get_tasks.id}"
}

resource "aws_lambda_permission" "api_gateway_get_tasks" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_tasks.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# --------------- Outputs ---------------

output "api_endpoint" {
  value       = aws_apigatewayv2_api.main.api_endpoint
  description = "API Gateway endpoint URL"
}
