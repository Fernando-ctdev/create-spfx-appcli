#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const prompts = require('prompts');
const kleur = require('kleur');

const TEMPLATE_REPO = process.env.SPFX_TEMPLATE_REPO || 'https://github.com/Fernando-ctdev/spfx-template-1.0.git';
const TEMPLATE_REF = process.env.SPFX_TEMPLATE_REF || '';

function printHelp() {
  console.log(`
Uso:
  create-spfx-app <nome-do-projeto> [opcoes]

Opcoes:
  --yes, -y            Aceita valores padrao sem perguntas interativas
  --pnp                Forca uso de PnP
  --no-pnp             Remove dependencias PnP do template
  --configure          Executa "pnpm run configure" ao final
  --no-configure       Nao executa configure
  --template <url>     URL do repositorio template (sobrescreve o padrao)
  --ref <branch|tag>   Branch ou tag do template
  --help, -h           Exibe esta ajuda

Variaveis de ambiente:
  SPFX_TEMPLATE_REPO   URL do template
  SPFX_TEMPLATE_REF    Branch ou tag do template
`);
}

function parseArgs(argv) {
  const parsed = {
    projectName: null,
    yes: false,
    usePnP: undefined,
    runConfigure: undefined,
    templateRepo: TEMPLATE_REPO,
    templateRef: TEMPLATE_REF,
    help: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (!arg.startsWith('-') && !parsed.projectName) {
      parsed.projectName = arg;
      continue;
    }

    if (arg === '--yes' || arg === '-y') parsed.yes = true;
    else if (arg === '--pnp') parsed.usePnP = true;
    else if (arg === '--no-pnp') parsed.usePnP = false;
    else if (arg === '--configure') parsed.runConfigure = true;
    else if (arg === '--no-configure') parsed.runConfigure = false;
    else if (arg === '--template') {
      parsed.templateRepo = argv[i + 1] || '';
      i += 1;
    } else if (arg === '--ref') {
      parsed.templateRef = argv[i + 1] || '';
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    }
  }

  return parsed;
}

function validateProjectName(projectName) {
  if (!projectName) return false;
  return /^[a-zA-Z0-9._-]+$/.test(projectName);
}

function ensureGitAvailable() {
  try {
    execSync('git --version', { stdio: 'ignore' });
  } catch {
    console.log(kleur.red('❌ Git não encontrado. Instale o Git e tente novamente.'));
    process.exit(1);
  }
}

function cloneTemplate(targetDir, templateRepo, templateRef) {
  try {
    const refOption = templateRef ? `--branch "${templateRef}" ` : '';
    execSync(`git clone --depth 1 ${refOption}"${templateRepo}" "${targetDir}"`, { stdio: 'inherit' });
  } catch (error) {
    const message = (error && error.message) ? error.message : '';

    if (/repository not found|not found|authentication failed|could not read username/i.test(message)) {
      console.log(kleur.red('\n❌ Não foi possível acessar o repositório do template.'));
      console.log(kleur.yellow('Verifique se a URL está correta e se você tem permissão de acesso.'));
      console.log(kleur.white(`URL atual: ${templateRepo}`));
      console.log(kleur.white('Dica: para repositório privado, autentique no Git (Credential Manager/SSH/PAT).\n'));
    }

    throw error;
  }
}

(async () => {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const projectName = args.projectName;

  if (process.argv.includes('--template') && !args.templateRepo) {
    console.log(kleur.red('❌ Informe um valor para --template <url>.'));
    process.exit(1);
  }

  if (process.argv.includes('--ref') && !args.templateRef) {
    console.log(kleur.red('❌ Informe um valor para --ref <branch|tag>.'));
    process.exit(1);
  }

  if (!projectName) {
    console.log(kleur.red('❌ Informe o nome do projeto'));
    printHelp();
    process.exit(1);
  }

  if (!validateProjectName(projectName)) {
    console.log(kleur.red('❌ Nome de projeto invalido. Use apenas letras, numeros, ponto, underline e hifen.'));
    process.exit(1);
  }

  const targetDir = path.resolve(process.cwd(), projectName);

  if (fs.existsSync(targetDir)) {
    console.log(kleur.red('❌ Pasta já existe'));
    process.exit(1);
  }

  ensureGitAvailable();

  const defaults = {
    usePnP: args.usePnP ?? true,
    runConfigure: args.runConfigure ?? true
  };

  let response = defaults;

  // Perguntas iniciais
  if (!args.yes && (typeof args.usePnP === 'undefined' || typeof args.runConfigure === 'undefined')) {
    response = await prompts([
      {
        type: typeof args.usePnP === 'undefined' ? 'confirm' : null,
        name: 'usePnP',
        message: 'Usar PnP?',
        initial: defaults.usePnP
      },
      {
        type: typeof args.runConfigure === 'undefined' ? 'confirm' : null,
        name: 'runConfigure',
        message: 'Rodar configure após criação?',
        initial: defaults.runConfigure
      }
    ]);

    response = {
      usePnP: typeof response.usePnP === 'undefined' ? defaults.usePnP : response.usePnP,
      runConfigure: typeof response.runConfigure === 'undefined' ? defaults.runConfigure : response.runConfigure
    };
  }

  if (!response || typeof response.usePnP === 'undefined' || typeof response.runConfigure === 'undefined') {
    console.log(kleur.yellow('\n⚠️ Operação cancelada pelo usuário.'));
    process.exit(0);
  }

  try {
    console.log(kleur.cyan('\n📦 Clonando template...\n'));

    cloneTemplate(targetDir, args.templateRepo, args.templateRef);

    // Remove .git
    fs.rmSync(path.join(targetDir, '.git'), { recursive: true, force: true });

    // Ajusta package.json
    const pkgPath = path.join(targetDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

    pkg.name = projectName;

    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

    // Remove PnP se necessário
    if (!response.usePnP) {
      delete pkg.dependencies["@pnp/sp"];
      delete pkg.dependencies["@pnp/logging"];
      delete pkg.dependencies["@pnp/graph"];

      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    }

    // Garante pnpm
    try {
      execSync('pnpm -v', { stdio: 'ignore' });
    } catch {
      console.log(kleur.yellow('\n⚙️ Instalando pnpm...\n'));
      execSync('npm install -g pnpm', { stdio: 'inherit' });
    }

    console.log(kleur.cyan('\n📥 Instalando dependências...\n'));
    execSync('pnpm install', { stdio: 'inherit', cwd: targetDir });

    // Roda configure
    if (response.runConfigure) {
      console.log(kleur.cyan('\n⚙️ Rodando configure...\n'));
      execSync('pnpm run configure', { stdio: 'inherit', cwd: targetDir });
    }

    console.log(kleur.green('\n✅ Projeto criado com sucesso!\n'));
    console.log(kleur.white(`cd ${projectName}`));
    console.log(kleur.white(`pnpm run serve`));

  } catch (err) {
    console.error(kleur.red('\n❌ Erro ao criar projeto\n'), err);
    process.exit(1);
  }
})();