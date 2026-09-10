// The transcript is what a human watches. English is the product's language; Portuguese is
// available because the people watching a QA run are not always the people who wrote it.
const STRINGS = {
  en: {
    navigation: '→ opened another page',
    'new-tab': '⧉ opened a new tab',
    'in-place-change': '✎ changed the screen',
    reload: '↻ reloaded the page',
    'hover-only': '⌄ opens on hover',
    'no-op': '· nothing changed',
    error: '✖ refused the click',
    guarded: (n) => `skipped "${n}" — destructive action, not clicking`,
    revealed: (n, by) => `+${n} new control${n > 1 ? 's' : ''} revealed by "${by}"`,
    watching: 'watch mode — a real window, slowed down so you can follow along'
  },
  pt: {
    navigation: '→ abriu outra página',
    'new-tab': '⧉ abriu nova aba',
    'in-place-change': '✎ mudou a tela',
    reload: '↻ recarregou a página',
    'hover-only': '⌄ abre no hover',
    'no-op': '· nada mudou',
    error: '✖ não aceitou o clique',
    guarded: (n) => `pulou "${n}" — ação destrutiva, não clico`,
    revealed: (n, by) => `+${n} controle${n > 1 ? 's' : ''} novo${n > 1 ? 's' : ''} revelado${n > 1 ? 's' : ''} por "${by}"`,
    watching: 'modo watch — janela real, em ritmo lento, para você acompanhar'
  }
}

let lang = 'en'
export function setLang(l) { if (STRINGS[l]) lang = l }
export function t(key, ...args) {
  const v = STRINGS[lang][key] ?? STRINGS.en[key] ?? key
  return typeof v === 'function' ? v(...args) : v
}
