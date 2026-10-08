import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

type Position = {
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  updated_at: string;
};

type Room = { id: string; code: string; owner_id: string };
type LobbyFixture = ReturnType<typeof createLobbyFixture>;

const baseURL = 'http://127.0.0.1:4173';
const names = { host: 'Éclaireur', guest: 'Guetteur' };

function createLobbyFixture() {
  const users = {
    host: { id: '10000000-0000-4000-8000-000000000001', token: 'host-session-token' },
    guest: { id: '20000000-0000-4000-8000-000000000002', token: 'guest-session-token' },
  };
  let room: Room | null = null;
  const profiles = new Map<string, string>();
  const members = new Map<string, string>();
  const positions = new Map<string, Position>();
  let codeSequence = 0;

  function currentUser(request: { headers(): Record<string, string> }) {
    const authorization = request.headers().authorization ?? '';
    return Object.values(users).find((user) => authorization.includes(user.token))?.id ?? users.host.id;
  }

  async function install(context: BrowserContext, identity: keyof typeof users) {
    const user = users[identity];
    await context.route('**/auth/v1/signup**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: user.token,
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: `${identity}-refresh-token`,
          user: { id: user.id, aud: 'authenticated', role: 'authenticated', is_anonymous: true, app_metadata: { provider: 'anonymous', providers: ['anonymous'] }, user_metadata: {}, created_at: new Date().toISOString() },
        }),
      });
    });

    await context.route('**/rest/v1/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const userId = currentUser(request);
      const path = url.pathname.replace('/rest/v1/', '');
      const body = request.postDataJSON?.() as Record<string, unknown> | Record<string, unknown>[] | undefined;
      const respond = (data: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });

      if (path === 'rpc/create_room' && request.method() === 'POST') {
        if (room) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Tu es déjà dans un lobby' }) });
        codeSequence += 1;
        room = { id: `30000000-0000-4000-8000-${String(codeSequence).padStart(12, '0')}`, code: 'HUNT01', owner_id: userId };
        members.set(userId, names[identity]);
        return respond([{ room_id: room.id, room_code: room.code }]);
      }
      if (path === 'rpc/join_room' && request.method() === 'POST') {
        const requestedCode = String((body as Record<string, unknown> | undefined)?.p_code ?? '');
        if (!room || room.code !== requestedCode) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Lobby introuvable ou fermé' }) });
        if (members.has(userId)) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Tu es déjà dans un lobby' }) });
        members.set(userId, names[identity]);
        return respond(room.id);
      }
      if (path === 'rpc/stop_sharing' && request.method() === 'POST') {
        positions.delete(userId);
        return respond(null);
      }
      if (path === 'rpc/leave_room' && request.method() === 'POST') {
        members.delete(userId);
        positions.delete(userId);
        return respond(null);
      }
      if (path === 'rpc/close_room' && request.method() === 'POST') {
        if (room?.owner_id === userId) {
          room = null;
          members.clear();
          positions.clear();
        }
        return respond(null);
      }

      if (path === 'profiles' && request.method() === 'GET') {
        const requestedId = url.searchParams.get('id')?.replace('eq.', '');
        const nickname = requestedId ? profiles.get(requestedId) : undefined;
        return respond(nickname ? [{ id: requestedId, nickname }] : []);
      }
      if (path === 'profiles' && request.method() === 'POST') {
        const record = Array.isArray(body) ? body[0] : body;
        const profileId = String(record?.id ?? userId);
        const nickname = String(record?.nickname ?? 'Joueur');
        profiles.set(profileId, nickname);
        const savedProfile = { id: profileId, nickname };
        return respond(request.headers().accept?.includes('application/vnd.pgrst.object+json') ? savedProfile : [savedProfile], 201);
      }
      if (path === 'rooms' && request.method() === 'GET') {
        const requestedId = url.searchParams.get('id')?.replace('eq.', '');
        return respond(room && room.id === requestedId ? [room] : []);
      }
      if (path === 'room_members' && request.method() === 'GET') {
        return respond([...members].map(([memberId, nickname]) => ({ user_id: memberId, profiles: { nickname } })));
      }
      if (path === 'positions' && request.method() === 'GET') return respond([...positions.values()]);
      if (path === 'positions' && request.method() === 'POST') {
        const record = Array.isArray(body) ? body[0] : body;
        const position = record as unknown as Position;
        positions.set(position.user_id, position);
        return respond([position], 201);
      }
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: `Unhandled fixture request: ${request.method()} ${url.pathname}` }) });
    });

    await context.route('https://basemaps.cartocdn.com/**', (route) => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ version: 8, sources: {}, layers: [] }),
    }));
  }

  return {
    users,
    members,
    positions,
    get room() { return room; },
    install,
  };
}

async function enterWithNickname(page: Page, nickname: string) {
  await page.goto(baseURL);
  await page.getByLabel('Ton pseudo').fill(nickname);
  await page.getByRole('button', { name: 'Entrer dans HUNT' }).click();
  await expect(page.getByRole('heading', { name: /Choisis/ })).toBeVisible();
}

async function expandSquad(page: Page) {
  const toggle = page.getByRole('button', { name: /Développer le panneau|Réduire le panneau/ });
  if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
}

async function createMobileContext(browser: Browser, fixture: LobbyFixture, identity: 'host' | 'guest', permissions: string[]) {
  const context = await browser.newContext({
    ...({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }),
  });
  await context.grantPermissions(permissions, { origin: baseURL });
  await fixture.install(context, identity);
  return { context, page: await context.newPage() };
}

test('two mobile players create, join, share, stop, leave, and close one private GPS lobby', async ({ browser }) => {
  const fixture = createLobbyFixture();
  const hostClient = await createMobileContext(browser, fixture, 'host', ['geolocation']);
  const guestClient = await createMobileContext(browser, fixture, 'guest', []);
  await hostClient.context.setGeolocation({ latitude: 43.2965, longitude: 5.3698, accuracy: 9 });
  await guestClient.context.setGeolocation({ latitude: 43.2967, longitude: 5.3701, accuracy: 12 });

  try {
    await enterWithNickname(hostClient.page, names.host);
    await hostClient.page.getByRole('button', { name: 'Créer une chasse' }).click();
    const code = await hostClient.page.locator('.room-identity h1').innerText();
    expect(code).toBe('HUNT01');
    await expect(hostClient.page.getByRole('complementary', { name: 'Escouade' }).getByText(names.host)).toBeVisible();
    await expect(hostClient.page.getByRole('status')).toContainText('±9 m');

    await enterWithNickname(guestClient.page, names.guest);
    await guestClient.page.locator('#join-code').fill(code);
    await guestClient.page.getByRole('button', { name: 'Rejoindre la chasse' }).click();
    await expect(guestClient.page.getByRole('heading', { name: code })).toBeVisible();
    await expect(hostClient.page.getByRole('complementary', { name: 'Escouade' }).getByText(names.guest)).toBeVisible();
    await expect(guestClient.page.getByRole('complementary', { name: 'Escouade' }).getByText(names.host)).toBeVisible();
    expect(fixture.members.size).toBe(2);

    await expect(guestClient.page.getByRole('status')).toContainText('Balise bloquée');
    await guestClient.context.grantPermissions(['geolocation'], { origin: baseURL });
    await guestClient.page.getByRole('switch', { name: 'Partager ma position avec l’escouade' }).click();
    await expect(guestClient.page.getByRole('status')).toContainText('±12 m');

    await guestClient.context.setGeolocation(null);
    await expect(guestClient.page.getByRole('status')).toContainText('Signal indisponible', { timeout: 15_000 });
    const retrySharing = guestClient.page.getByRole('switch', { name: 'Partager ma position avec l’escouade' });
    await expect(retrySharing).toBeEnabled();
    await expect(retrySharing).toHaveAttribute('aria-checked', 'false');
    await guestClient.context.setGeolocation({ latitude: 43.2971, longitude: 5.371, accuracy: 4 });
    await retrySharing.click();
    await expect(guestClient.page.getByRole('status')).toContainText('±4 m', { timeout: 10_000 });
    await expect.poll(() => fixture.positions.get(fixture.users.guest.id)?.accuracy).toBe(4);
    await expect(hostClient.page.getByRole('complementary', { name: 'Escouade' })).toContainText('±4 m', { timeout: 15_000 });
    await expect(hostClient.page.locator('.marker-wrap')).toHaveCount(2, { timeout: 15_000 });
    await expect(guestClient.page.locator('.marker-wrap')).toHaveCount(2, { timeout: 15_000 });
    expect(fixture.positions.get(fixture.users.guest.id)).toMatchObject({ latitude: 43.2971, longitude: 5.371, accuracy: 4 });

    await guestClient.context.setGeolocation(null);
    const guestPosition = fixture.positions.get(fixture.users.guest.id);
    expect(guestPosition).toBeDefined();
    fixture.positions.set(fixture.users.guest.id, { ...guestPosition!, updated_at: new Date(Date.now() - 46_000).toISOString() });
    await expect(hostClient.page.getByRole('complementary', { name: 'Escouade' }).getByText(/Dernier signal/)).toBeVisible({ timeout: 15_000 });
    await expect(hostClient.page.locator('.marker-wrap')).toHaveCount(1, { timeout: 15_000 });

    await hostClient.page.getByRole('switch', { name: 'Partager ma position avec l’escouade' }).click();
    await expect.poll(() => fixture.positions.has(fixture.users.host.id)).toBe(false);
    await expandSquad(guestClient.page);
    await guestClient.page.getByRole('button', { name: 'Quitter la chasse' }).click();
    await expect(guestClient.page.getByRole('button', { name: 'Créer une chasse' })).toBeVisible();
    expect(fixture.members.size).toBe(1);

    await expandSquad(hostClient.page);
    await hostClient.page.getByRole('button', { name: 'Fermer la chasse' }).click();
    await expect(hostClient.page.getByRole('button', { name: 'Créer une chasse' })).toBeVisible();
    expect(fixture.room).toBeNull();
    await guestClient.page.locator('#join-code').fill(code);
    await guestClient.page.getByRole('button', { name: 'Rejoindre la chasse' }).click();
    await expect(guestClient.page.locator('.action-error')).toContainText('Lobby introuvable ou fermé');
  } finally {
    await hostClient.context.close();
    await guestClient.context.close();
  }
});
