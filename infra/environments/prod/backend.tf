terraform {
  required_version = ">= 1.5.0"

  backend "s3" {
    # Replace ACCOUNT_ID after running bootstrap
    bucket         = "interview-app-tf-state-289427882196"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "interview-app-tf-locks"
    encrypt        = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
