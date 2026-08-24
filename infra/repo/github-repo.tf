# Constants
locals {
  # GitHub Actions integration ID (magic value)
  gh_actions_integration_id = 15368

  # Name of this repository
  repo_name = "todo-board"

  # Name of the repository's default branch
  default_branch_name = "main"
}

# This repository
#
# Typically, it has to be imported:
# terraform import github_repository.this $GH_REPO_NAME
resource "github_repository" "this" {
  name = local.repo_name

  visibility = "public"

  is_template = false

  has_discussions = false
  has_issues      = true
  has_projects    = false
  has_wiki        = false

  allow_merge_commit = true
  allow_squash_merge = false
  allow_rebase_merge = false

  allow_forking          = true
  allow_auto_merge       = true
  delete_branch_on_merge = true
}

# Job names
locals {
  job_names = {
    workflows    = "GitHub workflows"
    config       = "Config"
    root_infra   = "Root infra"
    backend_impl = "Backend implementation"
  }
}

# Branch protection ruleset for the default branch
resource "github_repository_ruleset" "default_branch" {
  name        = "Default branch"
  repository  = github_repository.this.name
  target      = "branch"
  enforcement = "active"

  conditions {
    ref_name {
      include = ["~DEFAULT_BRANCH"]
      exclude = []
    }
  }

  rules {
    creation                = true
    update                  = false
    deletion                = true
    required_linear_history = false
    required_signatures     = false
    non_fast_forward        = true # Block force pushes

    pull_request {
      allowed_merge_methods = ["merge"]
    }

    required_status_checks {
      required_check {
        context        = "${local.job_names.workflows} / Lint workflows"
        integration_id = local.gh_actions_integration_id
      }

      required_check {
        context        = "${local.job_names.config} / Check Terraform module"
        integration_id = local.gh_actions_integration_id
      }

      required_check {
        context        = "${local.job_names.root_infra} / Check Terraform module"
        integration_id = local.gh_actions_integration_id
      }

      required_check {
        context        = "${local.job_names.backend_impl} / Check Gradle root"
        integration_id = local.gh_actions_integration_id
      }

      strict_required_status_checks_policy = true
    }
  }
}

# Allow GitHub Actions from this repository to run
resource "github_actions_repository_permissions" "this" {
  repository      = github_repository.this.name
  enabled         = true
  allowed_actions = "all"
}

#region GitHub environments

# Production environment
resource "github_repository_environment" "production" {
  repository  = github_repository.this.name
  environment = "production"

  deployment_branch_policy {
    protected_branches     = false
    custom_branch_policies = true
  }
}

# Allow deployments only from the default branch
resource "github_repository_environment_deployment_policy" "production_trunk" {
  repository     = github_repository.this.name
  environment    = github_repository_environment.production.environment
  branch_pattern = local.default_branch_name
}

# Staging environment
resource "github_repository_environment" "staging" {
  repository  = github_repository.this.name
  environment = "staging"

  deployment_branch_policy {
    protected_branches     = false
    custom_branch_policies = true
  }
}

# Allow deployments only from the default branch
resource "github_repository_environment_deployment_policy" "staging_trunk" {
  repository     = github_repository.this.name
  environment    = github_repository_environment.staging.environment
  branch_pattern = local.default_branch_name
}

#endregion
