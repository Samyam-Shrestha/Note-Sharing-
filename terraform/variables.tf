variable "active_environment" {
  description = "The active environment routed by Nginx (blue or green)"
  default     = "blue"
  validation {
    condition     = contains(["blue", "green"], var.active_environment)
    error_message = "active_environment must be either 'blue' or 'green'."
  }
}
