# Quick Fake API

Quick Fake API is a versatile CLI tool for quickly setting up mock API endpoints for testing and development purposes.

## Installation

### macOS and Linux

1. Download the latest `quick-fake-api` binary from the [releases page](https://github.com/alkinum/quick-fake-api/releases).
2. Make the binary executable:
   ```
   chmod +x quick-fake-api
   ```
3. Move the binary to a directory in your PATH, for example:
   ```
   sudo mv quick-fake-api /usr/local/bin/
   ```

### Windows

1. Download the latest `quick-fake-api.exe` from the [releases page](https://github.com/alkinum/quick-fake-api/releases).
2. Move the executable to a directory in your PATH, or add the directory containing the executable to your PATH environment variable.

## Usage

You can run the tool using command-line arguments or by providing a configuration file.

### Command-line Usage

```bash
quick-fake-api [options] [path]
```


### Options

- `-p, --port <number>`: Set the HTTP server port (default: 3000)
- `-h, --host <domain>`: Specify the host domain of the server
- `-m, --methods <methods>`: Specify the HTTP methods the API accepts (comma-separated)
- `-r, --response <file>`: Specify the response body (file path or JSON string)
- `-s, --status <code>`: Specify the status code of the response (default: 200)
- `-P, --path <path>`: Specify the API path (alternative to positional argument)
- `-V, --validate <schema>`: Specify a JSON schema to validate the request body
- `-H, --headers <json>`: Specify custom headers for the response (JSON string)
- `-c, --config <file>`: Specify a configuration file (JSON or YAML)

### Configuration File

You can use a configuration file to set up multiple paths with different settings. The configuration file can be in JSON or YAML format.

Example configuration file (config.yaml):

```yaml
port: 8080
host: api.example.com
paths:
  - path: /users
    methods: [GET, POST]
    response: ./responses/users.json
    statusCode: 200
    headers:
      X-Custom-Header: CustomValue
  - path: /products
    methods: [GET]
    statusCode: 200
    validationSchema:
      type: object
      properties:
        id:
          type: integer
```


To use the configuration file:

```bash
quick-fake-api -c config.yaml
```


When using a configuration file, all other command-line options are ignored.

### Examples

1. Start a basic server on port 8080:

   ```
   quick-fake-api -p 8080
   ```

2. Create an endpoint for a specific host and methods:

   ```
   quick-fake-api -p 8080 -h api.example.com -m GET,POST /users
   ```

3. Return a custom response file with a specific status code:

   ```
   quick-fake-api -r ./response.json -s 201 /create
   ```

4. Validate incoming requests against a JSON schema:

   ```
   quick-fake-api -V '{"type":"object","properties":{"name":{"type":"string"}}}' /validate
   ```

## Detailed Parameter Explanation

- `-p, --port`: Specifies the port number on which the server will listen. Must be between 1 and 65535.

- `-h, --host`: Sets the host domain for the server. If specified, only requests matching this host will be processed.

- `-m, --methods`: Defines which HTTP methods the endpoint will accept. Multiple methods should be comma-separated. Valid methods are GET, POST, PUT, DELETE, PATCH, OPTIONS, and HEAD.

- `-r, --response`: Specifies the response body. If a file path is provided, the content of the file will be returned with the appropriate content-type header. If not specified, a default JSON response `{ "success": true }` is returned.

- `-s, --status`: Sets the HTTP status code for the response. Must be between 100 and 599.

- `-P, --path` or positional argument: Defines the API endpoint path. If not specified, defaults to '/'.

- `-V, --validate`: Accepts a JSON schema for validating the request body. If the request body doesn't match the schema, a 400 error is returned.

## Notes

- The tool automatically handles both HTTP and HTTPS requests.
- It supports HTTP/1.1, HTTP/2, and HTTP/3 protocols without additional configuration.
- All console output is colorized for better readability.
- Incoming requests and outgoing responses are logged in the console with appropriate formatting and colors.

## Error Handling

- The tool validates all input parameters and will exit with an error message if any parameters are invalid.
- If request body validation is enabled and the incoming request doesn't match the specified schema, a 400 error is returned with details about the validation failure.

## Limitations

- The tool is designed for development and testing purposes and may not be suitable for production environments.
- Large file responses may impact performance and should be used cautiously.

## Contributing

Contributions to improve Quick Fake API are welcome. Please feel free to submit issues or pull requests on the project's repository.

## License

This project is open-source and available under the MIT License.
