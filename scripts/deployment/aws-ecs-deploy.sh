#!/bin/bash
# Deploy to AWS ECS Fargate

set -e

AWS_REGION="${AWS_REGION:-us-east-1}"
ECR_REPOSITORY="dlifestyle-backend"
ECS_CLUSTER="dlifestyle-cluster"
ECS_SERVICE="dlifestyle-service"
TASK_FAMILY="dlifestyle-task"

echo "🚀 Starting AWS ECS Deployment..."

# Build Docker image
echo "📦 Building Docker image..."
docker build -f docker/Dockerfile -t $ECR_REPOSITORY:latest .

# Get ECR login token
echo "🔐 Authenticating with ECR..."
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$AWS_REGION.amazonaws.com

# Tag and push to ECR
ECR_URI=$(aws sts get-caller-identity --query Account --output text).dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY
docker tag $ECR_REPOSITORY:latest $ECR_URI:latest
docker push $ECR_URI:latest

echo "✅ Docker image pushed to ECR"
echo "📝 Next steps:"
echo "1. Update ECS task definition with new image URI: $ECR_URI:latest"
echo "2. Update ECS service: aws ecs update-service --cluster $ECS_CLUSTER --service $ECS_SERVICE --force-new-deployment --region $AWS_REGION"
