# SIMUNUS

Frontend de estudos. O painel administrativo é mantido separadamente para uso local e não integra este repositório.

Aplicação: `Simunus/index.html`.

A configuração do navegador contém a URL do projeto e uma chave pública Supabase do tipo `sb_publishable_`. O campo `anonKey` conserva o nome usado pelo cliente, mas seu valor é uma chave publishable, não uma chave secreta. Nunca use credenciais privilegiadas no navegador. O contato de suporte foi omitido desta distribuição pública.

Não inclua backups, relatórios internos, dados pessoais, tokens ou exportações do banco nos commits. O `.gitignore` não remove arquivos já rastreados nem segredos do histórico.

O SDK Supabase usa versão fixa 2.117.3 e verificação SRI. CSP limita scripts; estilos inline são mantidos por compatibilidade. Proteção contra enquadramento depende de headers da hospedagem.

## Estado da auditoria

A auditoria é parcial. A integração real de Auth/PostgREST, a auditoria completa e correções de backend permanecem pendentes. A publicação deste código não aplica SQL, não altera o Supabase e não ativa o site ou qualquer deployment. Esta publicação não constitui certificação de segurança nem liberação de produção.
