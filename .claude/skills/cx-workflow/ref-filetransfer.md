# File Transfer Tasks Reference

SFTP/FTP file transfer operations. Use `FileTransfer/Connect` to establish a session, perform file operations, then `FileTransfer/Disconnect`.

## Connection Lifecycle

```yaml
activities:
  - name: Transfer
    steps:
      - task: "FileTransfer/Connect@1"
        name: Connect
        inputs:
          host: "{{ sftpConfig.host }}"
          port: "{{ sftpConfig.port }}"
          username: "{{ sftpConfig.username }}"
          password: "{{ sftpConfig.password }}"
          protocol: "sftp"
        outputs:
          - name: connection
            mapping: "connection"

      - task: "FileTransfer/ListFiles@1"
        name: ListFiles
        inputs:
          connection: "{{ Transfer.Connect.connection }}"
          path: "/incoming"
        outputs:
          - name: files
            mapping: "files"

      - task: foreach
        name: ProcessFiles
        collection: "Transfer.ListFiles.files"
        item: "file"
        steps:
          - task: "FileTransfer/DownloadFile@1"
            name: Download
            inputs:
              connection: "{{ Transfer.Connect.connection }}"
              path: "{{ file.path }}"
            outputs:
              - name: content
                mapping: "content"

          - task: "FileTransfer/MoveFile@1"
            name: Archive
            inputs:
              connection: "{{ Transfer.Connect.connection }}"
              sourcePath: "{{ file.path }}"
              destinationPath: "/processed/{{ file.name }}"

      - task: "FileTransfer/Disconnect@1"
        name: Disconnect
        inputs:
          connection: "{{ Transfer.Connect.connection }}"
```

## Available Tasks

| Task | Description |
|------|-------------|
| `FileTransfer/Connect` | Establish SFTP/FTP connection |
| `FileTransfer/Disconnect` | Close connection |
| `FileTransfer/ListFiles` | List files in remote directory |
| `FileTransfer/DownloadFile` | Download file content |
| `FileTransfer/UploadFile` | Upload file to remote |
| `FileTransfer/MoveFile` | Move/rename remote file |
| `FileTransfer/DeleteFile` | Delete remote file |

## Upload Example

```yaml
- task: "FileTransfer/UploadFile@1"
  name: Upload
  inputs:
    connection: "{{ Transfer.Connect.connection }}"
    path: "/outgoing/report.csv"
    content: "{{ GenerateReport.Export.file }}"
```
