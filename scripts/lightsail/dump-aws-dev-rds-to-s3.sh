#!/usr/bin/env bash
set -euo pipefail

AWS_PROFILE_NAME="${AWS_PROFILE_NAME:-interview-app-terraform}"
AWS_REGION_NAME="${AWS_REGION_NAME:-us-east-1}"
ECS_CLUSTER="${ECS_CLUSTER:-interview-app-dev}"
ECS_SERVICE="${ECS_SERVICE:-interview-app-dev-backend}"
CONTAINER_NAME="${CONTAINER_NAME:-backend}"
S3_KEY_PREFIX="${S3_KEY_PREFIX:-dev/db-backups}"

task_arn="$(
  aws ecs list-tasks \
    --profile "$AWS_PROFILE_NAME" \
    --region "$AWS_REGION_NAME" \
    --cluster "$ECS_CLUSTER" \
    --service-name "$ECS_SERVICE" \
    --query 'taskArns[0]' \
    --output text
)"

if [[ "$task_arn" == "None" || -z "$task_arn" ]]; then
  echo "No running ECS task found for ${ECS_CLUSTER}/${ECS_SERVICE}." >&2
  exit 1
fi

task_definition="$(
  aws ecs describe-tasks \
    --profile "$AWS_PROFILE_NAME" \
    --region "$AWS_REGION_NAME" \
    --cluster "$ECS_CLUSTER" \
    --tasks "$task_arn" \
    --query 'tasks[0].taskDefinitionArn' \
    --output text
)"

eni_id="$(
  aws ecs describe-tasks \
    --profile "$AWS_PROFILE_NAME" \
    --region "$AWS_REGION_NAME" \
    --cluster "$ECS_CLUSTER" \
    --tasks "$task_arn" \
    --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value | [0]' \
    --output text
)"

subnet_id="$(
  aws ec2 describe-network-interfaces \
    --profile "$AWS_PROFILE_NAME" \
    --region "$AWS_REGION_NAME" \
    --network-interface-ids "$eni_id" \
    --query 'NetworkInterfaces[0].SubnetId' \
    --output text
)"

security_group_id="$(
  aws ec2 describe-network-interfaces \
    --profile "$AWS_PROFILE_NAME" \
    --region "$AWS_REGION_NAME" \
    --network-interface-ids "$eni_id" \
    --query 'NetworkInterfaces[0].Groups[0].GroupId' \
    --output text
)"

s3_bucket="$(
  aws ecs describe-task-definition \
    --profile "$AWS_PROFILE_NAME" \
    --region "$AWS_REGION_NAME" \
    --task-definition "$task_definition" \
    --query "taskDefinition.containerDefinitions[?name=='${CONTAINER_NAME}'].environment[?name=='AWS_S3_BUCKET'].value | [0]" \
    --output text
)"

if [[ "$s3_bucket" == "None" || -z "$s3_bucket" ]]; then
  echo "AWS_S3_BUCKET was not found in task definition ${task_definition}." >&2
  exit 1
fi

timestamp="$(date -u +"%Y%m%dT%H%M%SZ")"
s3_uri="s3://${s3_bucket}/${S3_KEY_PREFIX%/}/aws-dev-before-lightsail-${timestamp}.dump"

override_command="set -euo pipefail; apk add --no-cache postgresql16-client aws-cli >/tmp/dump-apk.log; pg_dump \"\$DATABASE_URL\" --format=custom --no-owner --no-acl | aws s3 cp - \"${s3_uri}\" --region \"${AWS_REGION_NAME}\""

dump_task_arn="$(
  aws ecs run-task \
    --profile "$AWS_PROFILE_NAME" \
    --region "$AWS_REGION_NAME" \
    --cluster "$ECS_CLUSTER" \
    --launch-type FARGATE \
    --task-definition "$task_definition" \
    --network-configuration "awsvpcConfiguration={subnets=[$subnet_id],securityGroups=[$security_group_id],assignPublicIp=ENABLED}" \
    --overrides "{\"containerOverrides\":[{\"name\":\"${CONTAINER_NAME}\",\"command\":[\"sh\",\"-c\",\"${override_command//\"/\\\"}\"]}]}" \
    --query 'tasks[0].taskArn' \
    --output text
)"

echo "Started dump task: ${dump_task_arn}"
echo "Target S3 object: ${s3_uri}"

aws ecs wait tasks-stopped \
  --profile "$AWS_PROFILE_NAME" \
  --region "$AWS_REGION_NAME" \
  --cluster "$ECS_CLUSTER" \
  --tasks "$dump_task_arn"

exit_code="$(
  aws ecs describe-tasks \
    --profile "$AWS_PROFILE_NAME" \
    --region "$AWS_REGION_NAME" \
    --cluster "$ECS_CLUSTER" \
    --tasks "$dump_task_arn" \
    --query 'tasks[0].containers[0].exitCode' \
    --output text
)"

if [[ "$exit_code" != "0" ]]; then
  echo "Dump task failed with exit code ${exit_code}." >&2
  exit 1
fi

aws s3 ls "$s3_uri" \
  --profile "$AWS_PROFILE_NAME" \
  --region "$AWS_REGION_NAME"

echo "Created AWS dev database dump: ${s3_uri}"
