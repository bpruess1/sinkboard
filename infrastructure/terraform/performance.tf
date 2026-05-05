# --------------- CloudFront CDN Configuration ---------------

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100" # US, Canada, Europe

  origin {
    domain_name = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id   = "S3-${aws_s3_bucket.frontend.id}"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.frontend.cloudfront_access_identity_path
    }
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.frontend.id}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    min_ttl     = 0
    default_ttl = 3600  # 1 hour
    max_ttl     = 86400 # 24 hours

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  # Cache static assets aggressively
  ordered_cache_behavior {
    path_pattern           = "/assets/*"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.frontend.id}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    min_ttl     = 31536000 # 1 year
    default_ttl = 31536000
    max_ttl     = 31536000

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Environment = var.environment
    Purpose     = "CDN"
  }
}

resource "aws_cloudfront_origin_access_identity" "frontend" {
  comment = "Access identity for sink-board frontend"
}

# --------------- DynamoDB Performance Configuration ---------------

resource "aws_dynamodb_table" "tasks" {
  name           = "${var.environment}-tasks"
  billing_mode   = "PAY_PER_REQUEST" # Auto-scaling for unpredictable load
  hash_key       = "PK"
  range_key      = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  # Global Secondary Index for status-based queries
  global_secondary_index {
    name            = "GSI1"
    hash_key        = "GSI1PK"
    range_key       = "GSI1SK"
    projection_type = "ALL"
  }

  # Point-in-time recovery for production
  point_in_time_recovery {
    enabled = var.environment == "production"
  }

  # Enable encryption at rest
  server_side_encryption {
    enabled = true
  }

  tags = {
    Environment = var.environment
    Purpose     = "TaskStorage"
  }
}

# --------------- API Gateway Caching ---------------

resource "aws_api_gateway_method_settings" "all" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  stage_name  = aws_api_gateway_stage.main.stage_name
  method_path = "*/*"

  settings {
    metrics_enabled        = true
    logging_level          = "INFO"
    data_trace_enabled     = false
    throttling_burst_limit = 5000
    throttling_rate_limit  = 10000
    caching_enabled        = var.environment == "production"
    cache_ttl_in_seconds   = 300 # 5 minutes for GET requests
  }
}

# --------------- Lambda Performance Optimization ---------------

resource "aws_lambda_function" "api" {
  function_name = "${var.environment}-api-handler"
  role          = aws_iam_role.lambda_exec.arn
  
  # Performance tuning
  memory_size = 1024 # Higher memory = more CPU
  timeout     = 30

  # Provisioned concurrency for production
  reserved_concurrent_executions = var.environment == "production" ? 10 : -1

  environment {
    variables = {
      TABLE_NAME       = aws_dynamodb_table.tasks.name
      NODE_ENV         = var.environment
      LOG_LEVEL        = var.environment == "production" ? "info" : "debug"
    }
  }

  tags = {
    Environment = var.environment
    Purpose     = "API"
  }
}

# --------------- Outputs ---------------

output "cloudfront_domain" {
  value       = aws_cloudfront_distribution.frontend.domain_name
  description = "CloudFront distribution domain for CDN access"
}

output "dynamodb_table" {
  value       = aws_dynamodb_table.tasks.name
  description = "DynamoDB table name for task storage"
}
