output "api_url" {
  description = "API Gateway URL — use this as BACKEND_URL"
  value       = aws_apigatewayv2_api.main.api_endpoint
}

output "api_id" {
  value = aws_apigatewayv2_api.main.id
}

output "service_discovery_service_arn" {
  description = "Cloud Map service ARN — pass to ECS for auto-registration"
  value       = aws_service_discovery_service.backend.arn
}

output "service_discovery_service_id" {
  value = aws_service_discovery_service.backend.id
}
