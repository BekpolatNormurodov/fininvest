import React from 'react';
import ReactDOM from 'react-dom/client';
import { RoleApp } from '@credit-core/ui';
import { Role } from '@credit-core/shared';
import '@credit-core/ui/styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RoleApp role={Role.DIRECTOR} title="FinInvest • Direktor" />
  </React.StrictMode>,
);
