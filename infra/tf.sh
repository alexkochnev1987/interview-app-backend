#!/bin/bash
# Wrapper for terraform that loads secrets from AWS Secrets Manager
# Usage: ./tf.sh plan|apply|destroy [extra args]
# Example: ./tf.sh plan
#          ./tf.sh apply -auto-approve

set -euo pipefail

SECRETS=$(aws secretsmanager get-secret-value \
  --secret-id interview-app/terraform-secrets \
  --region us-east-1 \
  --query SecretString \
  --output text)

export TF_VAR_db_password=$(echo "$SECRETS" | python3 -c "import sys,json;print(json.load(sys.stdin)['db_password'])")
export TF_VAR_jwt_secret=$(echo "$SECRETS" | python3 -c "import sys,json;print(json.load(sys.stdin)['jwt_secret'])")
export TF_VAR_google_client_id=$(echo "$SECRETS" | python3 -c "import sys,json;print(json.load(sys.stdin)['google_client_id'])")
export TF_VAR_google_client_secret=$(echo "$SECRETS" | python3 -c "import sys,json;print(json.load(sys.stdin)['google_client_secret'])")

terraform "$@"
