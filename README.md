# Github Action: 42Crunch REST API Static Security Testing

The REST API Static Security Testing action lets you add an automatic static application security testing (SAST) task to your CI/CD workflows. The action checks your OpenAPI files for their quality and security from a simple Git push to your project repository when the CI/CD workflow runs.

The action is powered by 42Crunch [API Contract Security Audit](https://docs.42crunch.com/latest/content/concepts/api_contract_security_audit.htm). Security Audit performs a static analysis of the API definition that includes more than 200 checks on best practices and potential vulnerabilities on how the API defines authentication, authorization, transport, and data coming in and going out. For more details on the checks, see [API Security Encyclopedia](https://apisecurity.io/encyclopedia/content/api-security-encyclopedia.htm).

As a result of the security testing, your APIs get an audit score, with 100 points meaning the most secure, best defined API. By default, the threshold score for the action to pass is 75 points for each audited API, but you can change the minimum score in the settings of the action.

API contracts must follow the OpenAPI Specification (OAS) (formely Swagger). Both OAS v2 and v3, and both JSON and YAML formats are supported.

You can create a free 42Crunch account at https://platform.42crunch.com/register, and then configure the action.

### Discover APIs

By default, the action locates all OpenAPI files in your project and submits them for static security testing. You can include or exclude specific paths from the discovery phase can omit the discovery phase completely by adding a configuration file `42c-conf.yaml` in the root of your repository and specifying rules for the discovery phase.

### Fine-tune the action

You can add a task configuration file `42c-conf.yaml` in the root of your repository, and to fine-tune the success/failure criteria. For example, you can choose on whether to accept invalid API contracts, or define a cut-off on a certain level of issue severity.

## Inputs

### `api-token`

**Required** The API token to access 42Crunch Platform. Please do not put your API token directly in the workflow file, but instead create a secret in your repository settings and refer to it as shown in the example below.

### `min-score`

Minimum score for OpenAPI files. Default: `75`

### `collection-name`

A name for the API collection. Default: `github`

## Prerequisites

Create an API token in 42Crunch platform and copy its value into a [repository secret](https://docs.github.com/en/actions/configuring-and-managing-workflows/creating-and-storing-encrypted-secrets) named `API_TOKEN`.

## Example usage

```yaml
uses: 42Crunch/api-security-audit-action@v1
with:
  api-token: ${{ secrets.API_TOKEN }}
```

The entire workflow which checks our the contents of the repository and runs security audit on the OpenAPI files found in the project might look like this:

```yaml
on: [push]

jobs:
  api_audit_job:
    runs-on: ubuntu-latest
    name: Audit OpenAPI files
    steps:
    - uses: actions/checkout@v2
    - uses: 42Crunch/api-security-audit-action@v1
      with:
        api-token: ${{ secrets.API_TOKEN }}
        min-score: 85
```

## Support

If you run into an issue, or have a question not answered here, you can create a support ticket at [support.42crunch.com](https://support.42crunch.com/), or ask your questions on the Q&A tab here.

The pipe is maintained by support@42crunch.com.

If you’re reporting an issue, please include:

- the version of the pipe
- relevant logs and error messages
- steps to reproduce
