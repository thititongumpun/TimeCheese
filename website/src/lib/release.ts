const RELEASES_URL = 'https://github.com/thititongumpun/TimeCheese/releases/latest';

export type Release = {
  version: string;
  msiUrl: string;
  exeUrl: string;
  dmgUrl: string;
  releasesUrl: string;
};

let cached: Promise<Release> | null = null;

async function fetchRelease(): Promise<Release> {
  let version = 'latest';
  let msiUrl = RELEASES_URL;
  let exeUrl = RELEASES_URL;
  let dmgUrl = RELEASES_URL;

  try {
    const res = await fetch('https://api.github.com/repos/thititongumpun/TimeCheese/releases/latest');
    if (res.ok) {
      const release = await res.json();
      version = release.tag_name ?? version;
      const assets: Array<{ name: string; browser_download_url: string }> = release.assets ?? [];
      const msi = assets.find((a) => a.name.endsWith('.msi'));
      const exe = assets.find((a) => a.name.endsWith('-setup.exe') || a.name.endsWith('.exe'));
      const dmg = assets.find((a) => a.name.endsWith('.dmg'));
      if (msi) msiUrl = msi.browser_download_url;
      if (exe) exeUrl = exe.browser_download_url;
      if (dmg) dmgUrl = dmg.browser_download_url;
    }
  } catch {
    // offline / rate-limited — fall back to the releases page for every link
  }

  return { version, msiUrl, exeUrl, dmgUrl, releasesUrl: RELEASES_URL };
}

export function getRelease(): Promise<Release> {
  if (!cached) cached = fetchRelease();
  return cached;
}
