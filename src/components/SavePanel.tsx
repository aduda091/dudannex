import { useState } from 'react';
import { Alert, App, Button, Card, Input, Popconfirm, Space, Typography } from 'antd';
import { CopyOutlined, DeleteOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import { useGame } from '../state/GameProvider';

const { Paragraph, Text } = Typography;

export function SavePanel() {
  const { exportText, importText, reset } = useGame();
  const { message } = App.useApp();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const doExport = () => {
    setError(null);
    setText(exportText());
  };

  const copy = async () => {
    const payload = text || exportText();
    setText(payload);
    try {
      await navigator.clipboard.writeText(payload);
      message.success('Save copied to the clipboard');
    } catch {
      message.warning('Clipboard blocked — select the text below and copy manually');
    }
  };

  const doImport = () => {
    try {
      importText(text);
      setError(null);
      message.success('Save loaded');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that save.');
    }
  };

  return (
    <div className="panel">
      <Card size="small" title="Save data">
        <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 0 }}>
          Progress is written to this browser's local storage every five seconds.
          To move a game somewhere else, export the JSON below and paste it into
          a text file — then paste it back here to restore.
        </Paragraph>
        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={doExport}>
            Export to box
          </Button>
          <Button icon={<CopyOutlined />} onClick={copy}>
            Copy to clipboard
          </Button>
          <Button
            type="primary"
            icon={<UploadOutlined />}
            disabled={!text.trim()}
            onClick={doImport}
          >
            Import from box
          </Button>
        </Space>

        {error && (
          <Alert type="error" showIcon message={error} style={{ marginTop: 12 }} />
        )}

        <Input.TextArea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          placeholder="Paste a save here, or press Export to put yours in this box."
          autoSize={{ minRows: 8, maxRows: 18 }}
          style={{ marginTop: 12, fontFamily: 'ui-monospace, monospace', fontSize: 11 }}
        />
        {text && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            {text.length.toLocaleString()} characters
          </Text>
        )}
      </Card>

      <Card size="small" title="Danger zone" style={{ marginTop: 12 }}>
        <Popconfirm
          title="Erase this game?"
          description="Local storage is wiped and you pick a new country. Export first if you want it back."
          okText="Erase"
          okButtonProps={{ danger: true }}
          onConfirm={reset}
        >
          <Button danger icon={<DeleteOutlined />}>
            Start over
          </Button>
        </Popconfirm>
      </Card>
    </div>
  );
}
