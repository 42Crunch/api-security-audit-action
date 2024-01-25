# GitHub Action: 42Crunch REST API Static Security Testing

The REST API Static Security Testing action locates REST API contracts that follow the OpenAPI Specification (OAS, formerly known as Swagger) and runs thorough security checks on them. Both OAS v2 and v3.0.x are supported, in both JSON and YAML format.

You can use this action in the following scenarios:

- Add automatic static API security testing (SAST) task to your CI/CD workflows.
- Perform these checks on pull request reviews and/or code merges.
- Flag the located issues in GitHub's Security / Code Scanning Alerts.

The action is powered by 42Crunch [API Security Audit](https://docs.42crunch.com/latest/content/concepts/api_contract_security_audit.htm). Security Audit performs a static analysis of the API definition that includes more than 300 checks on best practices and potential vulnerabilities related to authentication, authorization as well as data constraints.

## Discover APIs in your repositories

By default, this action will:

1. Look for any `.json` and `.yaml` files in the repository.
2. Pick the files that use OpenAPI schema.
3. Perform security audit on the OpenAPI definitions.

This way, you can locate any new or changed API contracts in the repository.

You can fine-tune how the action behaves by specifying specific parts of the repository or filename masks to be included or excluded in the discovery of APIs. You can even disable discovery completely and instead list only specific API files to be checked and map them to your existing APIs in 42Crunch API Security Platform. You configure all these settings in the configuration file `42c-conf.yaml`. For advanced examples, see [here](https://github.com/42Crunch/resources/tree/master/cicd/42c-conf-examples).

All discovered APIs are uploaded to an API collection in 42Crunch Platform. By default, the action uses the environment variables `GITHUB_REPOSITORY` and `GITHUB_REF` to name the repository and the branch/tag/PR name from where the API collection originated from. You can override the name using the `default-collection-name` action parameter. During the subsequent runs, the APIs in the collection are kept in sync with the changes in your repository.

## Use this action to block deployment of vulnerable APIs

Add this action to your CI/CD workflows in GitHub and have it fail on API definitions that contain security issues.

Security Audit gives each API contract an audit score from 0 to 100 reflecting the security surface of your APIs. You can use the `min-score` parameter of the GitHub Action to set the threshold for the audit score where the action fails (the default is `75`, if no other value is specified). This helps to catch APIs definitions of bad quality and address the issues as early as design time. 

More advanced failure conditions can be set in the configuration file `42c-conf.yaml`, such as audit score by category (security or data validation), severity level of issues, or even specific issues, specified by their issue ID. For advanced examples, see [here](https://github.com/42Crunch/resources/tree/master/cicd/42c-conf-examples).

Additionally, the plugin enforces [security quality gates](https://docs.42crunch.com/latest/content/concepts/security_quality_gates.htm) defined at the platform level (default or tag-driven ones). Security quality gates enforce the application security requirements defined within the enterprise.

## Reading detailed actionable reports

Each time the action runs, it includes a link to the detailed prioritized actionable report for each of your OpenAPI files:

<img src="images/link_to_detailed_report.jpg" width="1080" />

Follow the links to read the detailed report in 42Crunch Platform:

<img src="images/42Crunch_platform_Security_Audit.png" width="1080" />

## Uploading 42Crunch alerts to GitHub code scanning

You can also track the issues that the 42Crunch audit found directly in GitHub, on the **Security** tab under **Code scanning alerts**.

To enable that, simply include `upload-to-code-scanning:true` to the parameters of the action in your GitHub workflow.

<img src="images/42Crunch_GitHub-REST_API_Code_Scanning_Alerts.png" width="1080" />

Click any of the alerts to see its exact location in your code and to get the details of the vulnerability and the recommended remediation steps.

<img src="images/42Crunch_GitHub-Alert_Details.png" width="1080" />

## Getting started

This action uses 42Crunch API Security Audit service. Before using the action, you will need to have an account on the 42Crunch platform. If you are not a 42Crunch customer, you can request a free account from this page: https://42crunch.com/get-started/.

Then, follow the steps described in the [documentation](https://docs.42crunch.com/latest/content/tasks/integrate_github_actions.htm) to create an API token for the action to authenticate to 42Crunch Platform, and save it as a secret in GitHub.

## Action parameters

### `api-token`

**Required** The API token that the GitHub action uses to authenticate to 42Crunch Platform. Do not put your API token directly in the workflow file! Instead, create a Github secret in your repository settings and refer to it as shown in the example below.

### `min-score`

The minimum audit score that OpenAPI files must reach, otherwise the action fails. Default is `75`.

### `upload-to-code-scanning`

Upload the audit results to [Github Code Scanning](https://docs.github.com/en/github/finding-security-vulnerabilities-and-errors-in-your-code/about-code-scanning). Default is `false`. Note that the workflow must have specific permissions for this step to be successful. 

```YAML
...
jobs:
  run_42c_audit:
    permissions:
      contents: read # for actions/checkout to fetch code
      security-events: write # for results upload to Github Code Scanning
...
```

### `ignore-failures`

If set to `true`, forces to complete execution successfully even if the failures conditions (like min-score or SQG criteria) you have set are met. Default is `false`. 

This parameter can be useful if you want to detect SQG failures scenarios without enforcing them (i.e. give a grace period to development teams before you start breaking builds).

### `ignore-network-errors`

If set to `true`, forces to complete execution successfully even if a network error has occurred (such as a failure to connect to 42Crunch Platform, etc.). Default is `false`.

### `skip-local-checks`

If set to `true`, disables all failure conditions (like minimum score) set in the 42c-conf.yaml file and fails execution only if the criteria defined in SQGs are not met. Default is `false`.

### `platform-url`

The URL where you access 42Crunch Platform. Default is `https://platform.42crunch.com`.

If you are an enterprise customer, enter the URL you use to access your production platform.

### `root-directory`

The root directory that contains the `42c-conf.yaml` configuration file. If not specified, the current working directory for the plugin is used instead, which normally corresponds to the root of the checked out repository.

### `default-collection-name`

The default collection name used when creating collections for discovered apis. If no name is given, a default name is created from the repository and branch/PR information.

### `log-level`

Level of details in the logs, one of: `FATAL`, `ERROR`, `WARN`, `INFO`, `DEBUG`. Default is `INFO`.

### `share-everyone`

Automatically shares API collections created by the CI/CD task with everyone in your organization on 42Crunch Platform. Accepted values are: `OFF`, `READ_ONLY`, `READ_WRITE`. Default is `OFF`. Note that the identity the action runs under (the owner of the API token) must have the `Share with Everyone` permission, otherwise the task will fail with a 403 error.

### `json-report`

Writes an audit execution report in JSON format to the specified file. An [execution report](https://docs.42crunch.com/latest/content/tasks/integrate_github_actions.htm#scrollNav-4) details the list of APIs that were created, updated and deleted. This is useful if you want to automatically consume the results of the audit execution in a subsequent pipeline step. By default, no report is written.

### `api-tags`

The CI/CD task can automatically assign tags to newly created APIs. Tags are specified in the following format: `category1:name1 category2:name2`. This flag is *optional*.

### `sarif-report`

Converts the audit raw JSON format to SARIF and save the results into the specified file. By default, no report is written.

### `audit-timeout`

Sets the maximum timeout (in seconds) for the audit report. The task will fail if the result isn't ready within that interval. Default: `600`

## Prerequisites

Create an API token on the 42Crunch Platform and copy its value into a [repository secret](https://docs.github.com/en/actions/configuring-and-managing-workflows/creating-and-storing-encrypted-secrets) named `API_TOKEN`.

## Examples

### Single Step Example
A typical new step in an existing workflow would look like this:

```yaml
- name: 42crunch-static-api-testing
        uses: 42Crunch/api-security-audit-action@v3
        with:
          api-token: ${{ secrets.API_TOKEN }}
          default-collection-name: GitHub-MyRepo-${{ github.ref_name }}
          log-level: info
          json-report: audit-action-report-${{ github.run_id }}
          sarif-report: 42Crunch_AuditReport_${{ github.run_id }}.SARIF
```
### Full Workflow Example

A typical workflow which checks the contents of the repository, runs Security Audit on each of the OpenAPI files found in the project and saves the execution file as artifact would look like this:

```yaml
name: "42crunch-audit-workflow"

# follow standard Code Scanning triggers
on:
  push:
    branches: [ "main" ]
  pull_request:
    # The branches below must be a subset of the branches above
    branches: [ "main" ]
  schedule:
    - cron: '19 9 * * 6'

env:
  PLATFORM_URL: https://platform.42crunch.com

jobs:
  run_42c_audit:
    environment: QA
    permissions:
      contents: read # for actions/checkout to fetch code
      security-events: write # for results upload to Github Code Scanning
    runs-on: ubuntu-latest
    steps:
      - name: checkout repo
        uses: actions/checkout@v3
      - name: 42crunch-static-api-testing
        uses: 42Crunch/api-security-audit-action@v3
        with:
          api-token: ${{ secrets.API_TOKEN }}
          platform-url: ${{ env.PLATFORM_URL}}
          default-collection-name: GitHub-MyRepo-${{ github.ref_name }}
          # Upload results to Github code scanning
          upload-to-code-scanning: false
          log-level: info
          json-report: audit-action-report-${{ github.run_id }}
          sarif-report: 42Crunch_AuditReport_${{ github.run_id }}.SARIF
      - name: save-audit-report
        if: always()        
        uses: actions/upload-artifact@v3
        with:
          name: auditaction-report-${{ github.run_id }}
          path: audit-action-report-${{ github.run_id }}.json
          if-no-files-found: error
```

## Support

The action is maintained by the 42Crunch Ecosystems team. If you run into an issue, or have a question not answered here, you can create a support ticket at [support.42crunch.com](https://support.42crunch.com/).

When reporting an issue, do include:
- The version of the GitHub action
- Relevant logs and error messages
- Steps to reproduce the issue
