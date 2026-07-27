import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntApp, ConfigProvider, theme } from 'antd';
import { App } from './App';
import { GameProvider } from './state/GameProvider';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#1668dc',
          colorBgBase: '#0b1119',
          borderRadius: 6,
          fontSize: 13,
        },
      }}
    >
      <AntApp>
        <GameProvider>
          <App />
        </GameProvider>
      </AntApp>
    </ConfigProvider>
  </StrictMode>,
);
