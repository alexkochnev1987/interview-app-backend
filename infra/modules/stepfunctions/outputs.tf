output "state_machine_arn" {
  value = aws_sfn_state_machine.interview_pipeline.arn
}

output "process_interview_function_name" {
  value = aws_lambda_function.process_interview.function_name
}

output "generate_report_function_name" {
  value = aws_lambda_function.generate_report.function_name
}

output "lambda_role_arn" {
  value = aws_iam_role.lambda.arn
}
