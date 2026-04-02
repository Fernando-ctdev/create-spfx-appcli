#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const prompts = require('prompts');
const kleur = require('kleur');

const TEMPLATE_REPO = process.env.SPFX_TEMPLATE_REPO || 'https://github.com/Fernando-ctdev/spfx-template-1.0.git';

function ensureGitAvailable() {
  try {
    execSync('git --version', { stdio: 'ignore' });
  } catch {
    console.log(kleur.red('❌ Git não encontrado. Instale o Git e tente novamente.'));
    process.exit(1);
  }
}

function cloneTemplate(targetDir) {
  try {
    execSync(`git clone --depth 1 "${TEMPLATE_REPO}" "${targetDir}"`, { stdio: 'inherit' });
  } catch (error) {
    const message = (error && error.message) ? error.message : '';

    if (/repository not found|not found|authentication failed|could not read username/i.test(message)) {
      console.log(kleur.red('\n❌ Não foi possível acessar o repositório do template.'));
      console.log(kleur.yellow('Verifique se a URL está correta e se você tem permissão de acesso.'));
      console.log(kleur.white(`URL atual: ${TEMPLATE_REPO}`));
      console.log(kleur.white('Dica: para repositório privado, autentique no Git (Credential Manager/SSH/PAT).\n'));
    }

    throw error;
  }
}

(async () => {
  const projectName = process.argv[2];

  if (!projectName) {
    console.log(kleur.red('❌ Informe o nome do projeto'));
    process.exit(1);
  }

  const targetDir = path.resolve(process.cwd(), projectName);

  if (fs.existsSync(targetDir)) {
    console.log(kleur.red('❌ Pasta já existe'));
    process.exit(1);
  }

  ensureGitAvailable();

  // Perguntas iniciais
  const response = await prompts([
    {
      type: 'confirm',
      name: 'usePnP',
      message: 'Usar PnP?',
      initial: true
    },
    {
      type: 'confirm',
      name: 'runConfigure',
      message: 'Rodar configure após criação?',
      initial: true
    }
  ]);

  if (!response || typeof response.usePnP === 'undefined' || typeof response.runConfigure === 'undefined') {
    console.log(kleur.yellow('\n⚠️ Operação cancelada pelo usuário.'));
    process.exit(0);
  }

  try {
    console.log(kleur.cyan('\n📦 Clonando template...\n'));

    cloneTemplate(targetDir);

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