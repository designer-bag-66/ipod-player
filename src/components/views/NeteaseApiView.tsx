// ============================================================
// NeteaseApiView - 配置网易云 API 地址
// 内置地址是 Vercel 托管，手机网络常不可达；这里可填自建/其它可用地址
// ============================================================

import { useEffect, useState } from 'react';
import { usePrefs } from '@/stores/prefs';
import { useAuth } from '@/stores/auth';
import { useNavigation } from '@/stores/navigation';
import { checkApiAvailable, getBases, getLastApiError } from '@/services/netease';
import type { MenuItem } from '@/types';

export function NeteaseApiView() {
  const custom = usePrefs((s) => s.neteaseBase);
  const update = usePrefs((s) => s.update);
  const apiOnline = useAuth((s) => s.apiOnline);
  const apiError = useAuth((s) => s.errorMessage);
  const setItems = useNavigation((s) => s.setItems);

  const [value, setValue] = useState(custom);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState('');

  const runAction = async (label: string) => {
    if (label === '测试连接') {
      setTesting(true);
      setResult('');
      const ok = await checkApiAvailable();
      setResult(ok ? `可用：${getBases()[0]}` : `不可用：${getLastApiError()}`);
      setTesting(false);
      return;
    }
    if (label === '保存并重新连接') {
      update('neteaseBase', value.trim());
      setResult('已保存，正在重新连接…');
      await useAuth.getState().bootstrap();
      setResult(
        useAuth.getState().apiOnline
          ? '已连接'
          : `仍未连接：${useAuth.getState().errorMessage}`,
      );
      return;
    }
    if (label === '恢复默认地址') {
      setValue('');
      update('neteaseBase', '');
      setResult('已恢复默认，正在重新连接…');
      await useAuth.getState().bootstrap();
      setResult(
        useAuth.getState().apiOnline ? '已连接' : `仍未连接：${useAuth.getState().errorMessage}`,
      );
    }
  };

  useEffect(() => {
    (NeteaseApiView as unknown as { __action?: (label: string) => void }).__action = (label) => {
      void runAction(label);
    };
  });

  useEffect(() => {
    const items: MenuItem[] = [
      { kind: 'action', label: '测试连接', meta: testing ? '测试中…' : '' },
      { kind: 'action', label: '保存并重新连接' },
      { kind: 'action', label: '恢复默认地址' },
      { kind: 'title', label: apiOnline ? '状态：已连接' : '状态：未连接' },
      { kind: 'title', label: `在用：${getBases()[0]}` },
    ];
    setItems(items);
    return () => setItems([]);
  }, [testing, apiOnline, setItems]);

  return (
    <div className="h-full w-full flex flex-col items-center px-3 pt-2">
      <div className="text-[9px] mb-2 text-center leading-relaxed" style={{ color: 'var(--screen-text-muted)' }}>
        内置地址为 Vercel 托管，手机网络常被封。可填自建的 NeteaseCloudMusicApi（留空用内置）
      </div>

      <input
        className="np-input"
        value={value}
        placeholder="https://your-api.example.com"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        onChange={(e) => setValue(e.target.value)}
      />

      <button className="np-btn" onClick={() => void runAction('保存并重新连接')}>
        保存并重新连接
      </button>
      <button
        className="np-btn"
        style={{ background: 'linear-gradient(180deg, #6b7280, #4b5563)' }}
        onClick={() => void runAction('测试连接')}
      >
        {testing ? '测试中…' : '测试连接'}
      </button>

      {result ? (
        <div className="text-[9px] mt-3 break-all text-center" style={{ color: 'var(--screen-text-secondary)' }}>
          {result}
        </div>
      ) : apiError ? (
        <div className="text-[9px] mt-3 break-all text-center" style={{ color: 'var(--screen-text-secondary)' }}>
          {apiError}
        </div>
      ) : null}
    </div>
  );
}

export function neteaseApiAction(label?: string) {
  if (!label) return;
  (NeteaseApiView as unknown as { __action?: (label: string) => void }).__action?.(label);
}
