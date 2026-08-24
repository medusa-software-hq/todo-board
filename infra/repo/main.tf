# Configuration

terraform {
  required_version = ">= 1.15"

  backend "gcs" {
    # Organization's central Terraform state bucket
    bucket = "ms-tfstate-c1984596bdabf023"
    prefix = "repos/todo-board"
  }

  required_providers {
    github = {
      source  = "integrations/github"
      version = "~> 6.11"
    }
  }
}

# Module imports

module "config" {
  source = "../../config"
}

# GitHub provider

variable "gh_token" {
  description = "Organization-owned GitHub token."
  type        = string
  sensitive   = true
}

provider "github" {
  owner = module.config.gh_organization_name
  token = var.gh_token
}
