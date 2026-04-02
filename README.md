# create-spfx-app

CLI para criar projetos SPFx padronizados a partir de um template Git.

## Requisitos

- Node.js 18+
- Git instalado e disponivel no PATH

## Uso rapido

```bash
npx create-spfx-app meu-projeto
```

Ou, se instalado globalmente:

```bash
create-spfx-app meu-projeto
```

## Opcoes

```bash
create-spfx-app <nome-do-projeto> [opcoes]

Opcoes:
  --yes, -y            Aceita valores padrao sem perguntas interativas
  --pnp                Forca uso de PnP
  --no-pnp             Remove dependencias PnP do template
  --configure          Executa "pnpm run configure" ao final
  --no-configure       Nao executa configure
  --template <url>     URL do repositorio template
  --ref <branch|tag>   Branch ou tag do template
  --help, -h           Exibe ajuda
```

## Valores padrao

- Template: `https://github.com/Fernando-ctdev/spfx-template-1.0.git`
- `usePnP`: `true`
- `runConfigure`: `true`

## Variaveis de ambiente

- `SPFX_TEMPLATE_REPO`: sobrescreve a URL padrao do template
- `SPFX_TEMPLATE_REF`: define branch/tag do template

Exemplo:

```bash
SPFX_TEMPLATE_REF=v1.0.0 npx create-spfx-app meu-projeto --yes
```

## Exemplo sem interacao

```bash
npx create-spfx-app meu-projeto --yes --no-pnp --no-configure
```

## Publicacao no npm

```bash
npm login
npm publish --access public
```

## Licenca

MIT
