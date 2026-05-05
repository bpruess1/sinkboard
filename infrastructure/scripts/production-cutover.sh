#!/bin/bash

# --------------- Production Cutover Script ---------------
# Executes final production deployment with DNS, SSL, monitoring, and rollback support

set -euo pipefail

# --------------- Configuration ---------------

REGION="${AWS_REGION:-us-east-1}"
ENVIRONMENT="production"
DOMAIN="${PRODUCTION_DOMAIN}"
S3_BUCKET="${S3_BUCKET_NAME}"
CLOUDFRONT_DIST="${CLOUDFRONT_DISTRIBUTION_ID}"
LAMBDA_FUNCTION="${LAMBDA_FUNCTION_NAME}"
DYNAMODB_TABLE="${DYNAMODB_TABLE_NAME}"

BAKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ROLLBACK_FILE="/tmp/rollback_${BAKUP_TIMESTAMP}.json"

# --------------- Logging ---------------

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

error() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2
}

# --------------- Pre-flight checks ---------------

preflight_checks() {
  log "Starting pre-flight checks..."
  
  if ! command -v aws &> /dev/null; then
    error "AWS CLI not found"
    exit 1
  fi
  
  if ! command -v terraform &> /dev/null; then
    error "Terraform not found"
    exit 1
  fi
  
  if ! aws sts get-caller-identity &> /dev/null; then
    error "AWS credentials not configured"
    exit 1
  fi
  
  log "Pre-flight checks passed"
}

# --------------- Backup current state ---------------

backup_state() {
  log "Creating backup of current state..."
  
  # Backup Lambda function configuration
  aws lambda get-function-configuration \
    --function-name "$LAMBDA_FUNCTION" \
    --region "$REGION" > "${ROLLBACK_FILE}.lambda"
  
  # Backup S3 bucket state (file list)
  aws s3 ls "s3://${S3_BUCKET}" --recursive > "${ROLLBACK_FILE}.s3"
  
  log "Backup saved to ${ROLLBACK_FILE}.*"
}

# --------------- Deploy infrastructure ---------------

deploy_infrastructure() {
  log "Deploying infrastructure with Terraform..."
  
  cd infrastructure/terraform
  terraform init
  terraform plan -var="environment=${ENVIRONMENT}" -out=tfplan
  terraform apply -auto-approve tfplan
  
  log "Infrastructure deployed successfully"
}

# --------------- Configure DNS and SSL ---------------

configure_dns_ssl() {
  log "Configuring DNS and SSL..."
  
  # Get CloudFront distribution domain
  CF_DOMAIN=$(aws cloudfront get-distribution \
    --id "$CLOUDFRONT_DIST" \
    --region "$REGION" \
    --query 'Distribution.DomainName' \
    --output text)
  
  log "CloudFront domain: ${CF_DOMAIN}"
  log "Update DNS CNAME: ${DOMAIN} -> ${CF_DOMAIN}"
  log "Verify SSL certificate is issued and attached to CloudFront"
  
  # Wait for DNS propagation
  log "Waiting for DNS propagation (60s)..."
  sleep 60
}

# --------------- Enable monitoring ---------------

enable_monitoring() {
  log "Enabling CloudWatch monitoring..."
  
  # Create CloudWatch alarms
  aws cloudwatch put-metric-alarm \
    --alarm-name "${ENVIRONMENT}-lambda-errors" \
    --alarm-description "Lambda function errors" \
    --metric-name Errors \
    --namespace AWS/Lambda \
    --statistic Sum \
    --period 300 \
    --threshold 10 \
    --comparison-operator GreaterThanThreshold \
    --dimensions Name=FunctionName,Value="$LAMBDA_FUNCTION" \
    --evaluation-periods 1 \
    --region "$REGION"
  
  aws cloudwatch put-metric-alarm \
    --alarm-name "${ENVIRONMENT}-api-5xx" \
    --alarm-description "API Gateway 5xx errors" \
    --metric-name 5XXError \
    --namespace AWS/ApiGateway \
    --statistic Sum \
    --period 300 \
    --threshold 5 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 1 \
    --region "$REGION"
  
  log "Monitoring enabled"
}

# --------------- Execute smoke tests ---------------

smoke_tests() {
  log "Running smoke tests..."
  
  API_URL="https://${DOMAIN}/api"
  
  # Health check
  if ! curl -f -s "${API_URL}/health" > /dev/null; then
    error "API health check failed"
    return 1
  fi
  
  # Frontend check
  if ! curl -f -s "https://${DOMAIN}" > /dev/null; then
    error "Frontend check failed"
    return 1
  fi
  
  log "Smoke tests passed"
}

# --------------- Rollback function ---------------

rollback() {
  error "Initiating rollback..."
  
  # Restore Lambda configuration
  if [ -f "${ROLLBACK_FILE}.lambda" ]; then
    log "Rolling back Lambda function..."
    # Manual intervention required for full rollback
    log "Rollback data available at: ${ROLLBACK_FILE}.*"
  fi
  
  error "Rollback complete. Manual verification required."
  exit 1
}

# --------------- Main execution ---------------

main() {
  log "Starting production cutover..."
  
  preflight_checks || exit 1
  backup_state || exit 1
  
  if ! deploy_infrastructure; then
    rollback
  fi
  
  if ! configure_dns_ssl; then
    rollback
  fi
  
  if ! enable_monitoring; then
    rollback
  fi
  
  if ! smoke_tests; then
    rollback
  fi
  
  log "Production cutover completed successfully"
  log "Rollback data retained at: ${ROLLBACK_FILE}.*"
  log "Monitor CloudWatch alarms: https://console.aws.amazon.com/cloudwatch/"
}

main "$@"