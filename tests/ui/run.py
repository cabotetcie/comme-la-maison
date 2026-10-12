"""Parcours de bout en bout dans Chromium (mobile + ordinateur) avec le faux client de test.
Usage : python3 tests/ui/run.py   (le serveur local doit tourner : npm start)"""
import re, sys, pathlib
from playwright.sync_api import sync_playwright, expect

BASE = 'http://localhost:5173/'
HERE = pathlib.Path(__file__).parent
SHOTS = HERE.parent / 'screens'
SHOTS.mkdir(exist_ok=True)
FAKE = (HERE / 'fake-supabase.js').read_text()
errors = []
results = []

def ok(name):
    results.append(name); print('  ✓', name)

def setup(page, label):
    page.on('console', lambda m: m.type == 'error' and '404' not in m.text and 'ERR_FAILED' not in m.text and errors.append(f'[{label}] {m.text}'))
    page.on('pageerror', lambda e: errors.append(f'[{label}] {e}'))

def route(r):
    url = r.request.url
    return r.continue_() if url.startswith(BASE) else r.abort()

def toast_wait(page, text):
    expect(page.locator('.toast', has_text=text).first).to_be_visible(timeout=4000)

def submit(page, sel='#sheet form button.primary'):
    page.locator(sel).last.click()

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
                              locale='fr-FR', timezone_id='Europe/Paris')
    ctx.add_init_script(FAKE)
    ctx.route('**/*', route)
    a = ctx.new_page(); setup(a, 'Adrien')
    a.goto(BASE)

    # ---------------- 1. Première ouverture : « Je suis Adrien » + code du foyer
    a.locator('form[data-form=setup]').wait_for()
    a.locator('label.who', has_text='Je suis Adrien').click()
    a.fill('input[name=code]', 'framboise'); a.fill('input[name=code2]', 'framboise')
    a.screenshot(path=SHOTS / '01-premiere-ouverture.png')
    a.get_by_role('button', name='Créer notre foyer').click()
    a.locator('.hero h1', has_text='Bonjour Adrien').wait_for()
    a.reload(); a.locator('.hero h1', has_text='Bonjour Adrien').wait_for()
    ok('Première ouverture : « Je suis Adrien » + code, foyer créé ; après rechargement, reconnu directement')
    a.screenshot(path=SHOTS / '03-accueil-mobile.png', full_page=True)

    # données initiales
    a.goto(BASE + '#/maison'); a.get_by_role('tab', name='Récurrences').click()
    expect(a.locator('.series-row')).to_have_count(19)
    expect(a.locator('.series-row', has_text='Changer les draps')).to_contain_text('Une semaine sur deux')
    expect(a.locator('.series-row', has_text='Passer la serpillière')).to_contain_text('mercredi, vendredi, dimanche')
    a.screenshot(path=SHOTS / '04-recurrences.png', full_page=True)
    a.goto(BASE + '#/courses')
    expect(a.locator('.shop-row')).to_have_count(7)
    expect(a.locator('.shop-cat', has_text='Boissons').locator('.shop-row')).to_have_count(3)
    a.goto(BASE + '#/inbox')
    expect(a.locator('.inbox-row', has_text='Revisser le lit')).to_be_visible()
    expect(a.locator('.inbox-row', has_text='Hello bank!')).to_be_visible()
    ok('Données initiales : 19 récurrences, 2 tâches ponctuelles à organiser, 7 produits')
    a.screenshot(path=SHOTS / '05-a-organiser.png', full_page=True)

    # ---------------- 2. Répartition du jour (personne seule : Ilona pas encore là) puis progression
    a.goto(BASE + '#/today')
    unassigned = a.locator('section.card', has_text='À répartir').locator('.task').count()
    assert unassigned >= 1, 'tâches du jour attendues'
    a.locator('section.card', has_text='À répartir').get_by_role('button', name='Répartir', exact=True).click()
    a.locator('form[data-form=dist] button.primary').click()
    a.locator('.proposal').first.wait_for()
    a.screenshot(path=SHOTS / '06-repartition-apercu.png', full_page=True)
    n_props = a.locator('.proposal').count()
    a.get_by_role('button', name='Appliquer la sélection').click()
    toast_wait(a, 'Répartition appliquée')
    expect(a.locator('section.card', has_text='À répartir')).to_have_count(0)
    ok(f'Répartition prévisualisée puis appliquée ({n_props} propositions)')

    foyer = a.locator('.progress-card.foyer')
    total = int(re.search(r'sur (\d+)', foyer.inner_text()).group(1))
    first = a.locator('.person-card .task').first
    title = first.locator('.task-title').inner_text()
    first.locator('.check').click()
    expect(foyer).to_contain_text(f'1 tâche sur {total} terminée')
    first_done = a.locator('.person-card .task.done', has_text=title)
    expect(first_done).to_have_count(1)
    first_done.locator('.check').click()
    expect(foyer).to_contain_text(f'0 tâche sur {total} terminée')
    ok(f'Validation puis annulation : progression foyer « 1 tâche sur {total} » ↔ « 0 tâche sur {total} »')

    # ---------------- 3. Capture rapide → tâche datée, avec sous-actions via modification
    a.locator('.fab').click()
    a.fill('#sheet input[name=title]', 'Réparer le lit')
    a.locator('#sheet label', has_text='Aujourd’hui').first.click()
    a.screenshot(path=SHOTS / '07-capture.png')
    submit(a)
    toast_wait(a, 'Tâche ajoutée')
    a.locator('.task', has_text='Réparer le lit').first.wait_for()
    a.locator('.task', has_text='Réparer le lit').first.locator('.task-main').click()
    a.locator('#sheet').get_by_role('button', name='Modifier', exact=True).click()
    a.locator('#sheet label', has_text='Haute').click()
    for s in ['Identifier les vis desserrées', 'Préparer les outils', 'Revisser le lit']:
        a.get_by_role('button', name='Ajouter une sous-action').click()
        a.locator('#sub-editor .sub-row:last-child input[name=sub]').fill(s)
    a.fill('#sheet input[name=duration]', '25')
    a.screenshot(path=SHOTS / '08-formulaire-tache.png', full_page=True)
    submit(a)
    toast_wait(a, 'Modifications enregistrées')
    row = a.locator('.person-card .task', has_text='Réparer le lit')
    expect(row).to_contain_text('Haute'); expect(row).to_contain_text('0/3'); expect(row).to_contain_text('25 min')
    expect(a.locator('section.card', has_text='Priorités du jour').locator('.task', has_text='Réparer le lit')).to_be_visible()
    # sous-actions sans effet sur la progression
    before = foyer.inner_text()
    row.locator('.task-main').click()
    a.locator('#sheet .subs input').first.check()
    expect(a.locator('#sheet .subs')).to_contain_text('1/3')
    a.locator('#sheet [data-act=close-sheet]').first.click()
    assert re.search(r'(\d+) tâches? sur (\d+)', foyer.inner_text()).group(0) == re.search(r'(\d+) tâches? sur (\d+)', before).group(0)
    ok('Capture rapide, modification (priorité, durée, 3 sous-actions) ; les sous-actions ne comptent pas')

    # ---------------- 4. Occurrence récurrente : valider + reporter sans doublon
    a.goto(BASE + '#/maison'); a.get_by_role('tab', name='Aujourd’hui').click()
    asp = a.locator('.task', has_text='Passer l’aspirateur')
    expect(asp).to_have_count(1)
    asp.locator('.task-main').click()
    a.locator('#sheet').get_by_role('button', name='Demain', exact=True).click()
    toast_wait(a, 'Reportée demain')
    expect(a.locator('.task', has_text='Passer l’aspirateur')).to_have_count(0)
    a.get_by_role('tab', name='Semaine').click()
    tomorrow_card = a.locator('.day-card').filter(has=a.locator('.task', has_text='Passer l’aspirateur')).nth(1)
    counts = [a.locator('.day-card').nth(i).locator('.task', has_text='Passer l’aspirateur').count() for i in range(7)]
    print('    aspirateur par jour :', counts)
    import datetime, zoneinfo
    ti = datetime.datetime.now(zoneinfo.ZoneInfo('Europe/Paris')).weekday()
    assert counts[ti] == 0 and (ti == 6 or counts[ti + 1] == 2) and all(c == 1 for c in counts[ti + 2:]), counts
    ok('Report d’une occurrence : disparaît du jour, apparaît une fois de plus le lendemain, série intacte')
    a.screenshot(path=SHOTS / '09-semaine.png', full_page=True)
    a.get_by_role('tab', name='Récurrences').click()
    a.locator('.series-row', has_text='Passer l’aspirateur').click()
    expect(a.locator('#sheet select[name=freq]')).to_have_value('daily')
    a.locator('#sheet select[name=freq]').select_option('weekly')
    expect(a.locator('#sheet .days-pick.week7')).to_be_visible()
    a.locator('#sheet [data-act=close-sheet]').first.click()
    ok('Fréquence d’une série modifiable depuis l’interface')

    # ---------------- 5. Ilona sur son téléphone : « Je suis Ilona » + code
    b = ctx.new_page(); setup(b, 'Ilona')
    b.goto(BASE)
    b.locator('form[data-form=enter]').wait_for()
    b.locator('label.who', has_text='Je suis Ilona').click()
    b.fill('input[name=code]', 'mauvais'); b.get_by_role('button', name='Entrer').click()
    expect(b.locator('.notice.warn')).to_contain_text('Code du foyer incorrect')
    b.screenshot(path=SHOTS / '10-qui-es-tu.png')
    b.fill('input[name=code]', 'framboise'); b.get_by_role('button', name='Entrer').click()
    b.locator('.hero h1', has_text='Bonjour Ilona').wait_for()
    b.reload(); b.locator('.hero h1', has_text='Bonjour Ilona').wait_for()
    expect(b.locator('.person-card.p-adrien .task', has_text='Réparer le lit')).to_be_visible()
    ok('Ilona : mauvais code refusé, bon code accepté, reconnue après rechargement, voit les tâches du foyer')
    b.screenshot(path=SHOTS / '11-accueil-ilona.png', full_page=True)
    # synchronisation : Ilona ajoute un produit, Adrien le voit
    b.goto(BASE + '#/courses')
    b.fill('form[data-form=shop-add] input[name=text]', '2 kg pommes')
    b.locator('form[data-form=shop-add] button').click()
    toast_wait(b, 'pommes ajouté')
    a.goto(BASE + '#/courses')
    expect(a.locator('.shop-cat', has_text='Fruits et légumes').locator('.shop-row', has_text='pommes')).to_contain_text('2 kg')
    ok('Ajout d’Ilona visible et classé chez Adrien (2 kg pommes → Fruits et légumes)')

    # ---------------- 6. Absence + répartition
    b.goto(BASE + '#/dispos')
    b.locator('form[data-form=avail] label', has_text='Cette semaine').click()
    b.screenshot(path=SHOTS / '12-disponibilites.png', full_page=True)
    b.locator('form[data-form=avail] button.primary').click()
    try:
        b.locator('#confirm[open]').wait_for(timeout=2500)
        b.locator('#confirm-ok').click()
    except Exception:
        b.locator('[data-act=distribute]').first.click()
    b.locator('#sheet label', has_text='Tout rééquilibrer').click()
    b.locator('form[data-form=dist] button.primary').click()
    b.locator('.proposal').first.wait_for()
    texts = b.locator('.proposal').all_inner_texts()
    assert texts and not any('Attribuer → Ilona' in t for t in texts), 'rien ne doit être attribué à Ilona pendant son absence'
    import datetime as _dt, zoneinfo as _zi
    _t = _dt.datetime.now(_zi.ZoneInfo('Europe/Paris')).date()
    _absent = {f"{d.day} " for d in (_t + _dt.timedelta(days=i) for i in range(7 - _t.weekday()))}
    assert all(t.split('Reporter → Ilona le ')[1].split(' ')[1] + ' ' not in _absent for t in texts if 'Reporter → Ilona' in t), 'report seulement après son retour'

    assert any('Ilona absente' in t for t in texts)
    b.screenshot(path=SHOTS / '13-repartition-absence.png', full_page=True)
    b.get_by_role('button', name='Appliquer la sélection').click()
    toast_wait(b, 'Répartition appliquée')
    b.goto(BASE + '#/today')
    expect(b.locator('.person-card.p-ilona')).to_contain_text('absente aujourd’hui')
    ok(f'Ilona absente cette semaine : {len(texts)} propositions, aucune pour Ilona')

    # attribution manuelle incompatible → signalée
    b.goto(BASE + '#/maison'); b.get_by_role('tab', name='Aujourd’hui').click()
    t0 = b.locator('.task').first; t0.locator('.task-main').click()
    b.locator('#sheet .seg button', has_text='Ilona').click()
    toast_wait(b, 'Responsable : Ilona')
    b.locator('#sheet [data-act=close-sheet]').first.click()
    b.goto(BASE + '#/today')
    expect(b.locator('.notice.warn', has_text='Attribution incompatible')).to_be_visible()
    ok('Attribution manuelle incompatible avec une absence : signalée')

    # ---------------- 7. Repas → ingrédients → courses (avec inventaire)
    a.goto(BASE + '#/stock')
    a.get_by_role('button', name='Produit', exact=True).click()
    a.fill('#sheet input[name=name]', 'Riz'); a.fill('#sheet input[name=qty]', '1'); a.fill('#sheet input[name=unit]', 'kg')
    submit(a); toast_wait(a, 'Inventaire mis à jour')
    a.goto(BASE + '#/repas'); a.get_by_role('tab', name='Idées de repas').click()
    a.get_by_role('button', name='Nouvelle idée').click()
    a.fill('#sheet input[name=name]', 'Curry de légumes')
    rows = [('Riz', '300', 'g'), ('Lait de coco', '40', 'cl'), ('Carottes', '3', '')]
    for k, (n, q, u) in enumerate(rows):
        r = a.locator('#ing-editor .ing-row').nth(k)
        r.locator('input[name=ing]').fill(n); r.locator('input[name=ingqty]').fill(q); r.locator('input[name=ingunit]').fill(u)
    a.locator('#sheet input[name=favorite]').check()
    submit(a); toast_wait(a, 'Idée de repas enregistrée')
    a.locator('.recipe', has_text='Curry').get_by_role('button', name='Planifier', exact=True).click()
    submit(a); toast_wait(a, 'Repas planifié')
    a.get_by_role('tab', name='Menu de la semaine').click()
    a.screenshot(path=SHOTS / '14-menus.png', full_page=True)
    a.get_by_role('button', name='Ajouter les ingrédients aux courses').click()
    sheet = a.locator('#sheet')
    expect(sheet.locator('.ing-check', has_text='Riz')).to_contain_text('Assez en stock')
    expect(sheet.locator('.ing-check', has_text='Riz').locator('input[name=pick]')).not_to_be_checked()
    expect(sheet.locator('.ing-check', has_text='Lait de coco')).to_contain_text('déjà sur la liste')
    a.screenshot(path=SHOTS / '15-ingredients-verification.png', full_page=True)
    submit(a)
    toast_wait(a, 'sur la liste')
    a.goto(BASE + '#/courses')
    expect(a.locator('.shop-row', has_text='Lait de coco')).to_have_count(1)
    expect(a.locator('.shop-row', has_text='Lait de coco')).to_contain_text('40 cl')
    expect(a.locator('.shop-row', has_text='Carottes')).to_contain_text('3')
    expect(a.locator('.shop-row', has_text='Riz')).to_have_count(0)
    ok('Ingrédients → courses : stock pris en compte (riz), fusion sans doublon (lait de coco), ajout (carottes)')

    # ---------------- 8. Cocher ≠ inventaire ; Ranger les achats
    inv_before = None
    a.locator('.shop-row', has_text='Carottes').locator('input[type=checkbox]').check()
    a.goto(BASE + '#/stock'); expect(a.locator('.inv-row', has_text='Carottes')).to_have_count(0)
    a.goto(BASE + '#/courses')
    a.get_by_role('button', name='Ranger les achats').click()
    a.locator('#sheet select[name=loc0]').select_option('frigo')
    submit(a); toast_wait(a, 'rangé')
    a.goto(BASE + '#/stock')
    expect(a.locator('.inv-row', has_text='Carottes')).to_contain_text('3')
    a.locator('.inv-row', has_text='Riz').locator('[data-act=inv-dec]').click()
    expect(a.locator('.inv-row', has_text='Riz')).to_contain_text('0,75 kg')
    a.screenshot(path=SHOTS / '16-inventaire.png', full_page=True)
    ok('Cocher ne touche pas l’inventaire ; « Ranger les achats » l’alimente ; diminution du stock')


    # ---------------- 8 bis. Repas ↔ inventaire ↔ courses
    a.goto(BASE + '#/repas'); a.get_by_role('tab', name='Avec ce qu’on a').click()
    card = a.locator('.sugg', has_text='Curry de légumes')
    expect(card).to_contain_text('Il manque 1 ingrédient')
    expect(card.locator('.ing-missing')).to_contain_text('Lait de coco')
    a.screenshot(path=SHOTS / '17-avec-ce-quon-a.png', full_page=True)
    ok('« Avec ce qu’on a » : Curry classé, lait de coco signalé manquant')
    a.goto(BASE + '#/today')
    a.locator('.meal-row', has_text='Curry de légumes').get_by_role('button', name=re.compile('Marquer')).click()
    sheet = a.locator('#sheet')
    riz = sheet.locator('.cook-line', has_text='Riz')
    expect(riz.locator('input[name^=amt]')).to_have_value('0,3')
    car = sheet.locator('.cook-line', has_text='Carottes')
    expect(car.locator('input[name=shop]')).to_be_checked()
    a.screenshot(path=SHOTS / '18-cuisiner.png', full_page=True)
    sheet.get_by_role('button', name='Valider et mettre à jour l’inventaire').click()
    toast_wait(a, 'mis à jour dans l’inventaire')
    expect(a.locator('.meal-row', has_text='Curry de légumes').locator('.cook-chip')).to_be_visible()
    a.goto(BASE + '#/stock')
    expect(a.locator('.inv-row', has_text='Riz')).to_contain_text('0,45 kg')
    expect(a.locator('.inv-row', has_text='Carottes').first).to_contain_text('0')
    a.goto(BASE + '#/courses')
    expect(a.locator('.shop-row:not(.done)', has_text='Carottes')).to_have_count(1)
    ok('Repas cuisiné : riz 0,75 → 0,45 kg, carottes épuisées ajoutées aux courses')
    a.goto(BASE + '#/today')
    a.locator('.meal-row', has_text='Curry de légumes').locator('.cook-chip').click()
    a.locator('#confirm-ok').click()
    toast_wait(a, 'remis dans l’inventaire')
    a.goto(BASE + '#/stock')
    expect(a.locator('.inv-row', has_text='Riz')).to_contain_text('0,75 kg')
    ok('Annulation : les quantités reviennent dans l’inventaire')

    # ---------------- 9. Suppression importante → confirmation
    a.goto(BASE + '#/maison'); a.get_by_role('tab', name='Récurrences').click()
    a.locator('.series-row', has_text='Nettoyer Valérie').click()
    a.locator('#sheet').get_by_role('button', name='Supprimer la série').click()
    expect(a.locator('#confirm')).to_be_visible()
    a.locator('#confirm-cancel').click()
    a.locator('#sheet [data-act=close-sheet]').first.click()
    expect(a.locator('.series-row', has_text='Nettoyer Valérie')).to_have_count(1)
    ok('Suppression d’une série : confirmation demandée (annulée)')

    # ---------------- 10. Captures d'écran de tous les écrans
    for r, n in [('today', '20-accueil'), ('maison', '21-maison'), ('repas', '22-repas'), ('courses', '23-courses'), ('stock', '24-stock'), ('dispos', '25-dispos'), ('inbox', '26-inbox'), ('foyer', '27-foyer')]:
        a.goto(BASE + '#/' + r); a.wait_for_timeout(150)
        a.screenshot(path=SHOTS / f'{n}-mobile.png')
    # débordement horizontal
    for r in ['today', 'maison', 'repas', 'courses', 'stock', 'dispos', 'inbox', 'foyer']:
        a.goto(BASE + '#/' + r); a.wait_for_timeout(100)
        w = a.evaluate('document.documentElement.scrollWidth')
        assert w <= 391, f'débordement horizontal sur {r}: {w}px'
    ok('Aucun débordement horizontal sur mobile (390 px)')
    a.locator('.fab').click(); a.screenshot(path=SHOTS / '28-ajout-rapide-mobile.png'); a.locator('#sheet [data-act=close-sheet]').first.click()

    desk = browser.new_context(storage_state=ctx.storage_state(), viewport={'width': 1360, 'height': 900}, locale='fr-FR', timezone_id='Europe/Paris')
    desk.add_init_script(FAKE); desk.route('**/*', route)
    d = desk.new_page(); setup(d, 'Bureau')
    d.goto(BASE)
    d.locator('label.who', has_text='Je suis Adrien').click()
    d.fill('input[name=code]', 'framboise'); d.get_by_role('button', name='Entrer').click()
    d.locator('.hero').wait_for()
    d.goto(BASE + '#/foyer')
    expect(d.locator('.member.p-adrien')).to_contain_text('2 appareils')
    ok('Adrien sur un 2e appareil (ordinateur) : reconnu, 2 appareils listés')
    for r, n in [('today', '30-accueil'), ('maison', '31-maison'), ('repas', '32-repas'), ('courses', '33-courses')]:
        d.goto(BASE + '#/' + r); d.wait_for_timeout(150)
        d.screenshot(path=SHOTS / f'{n}-bureau.png', full_page=True)
    browser.close()

print('\n'.join(['', f'{len(results)} vérifications réussies']))
if errors:
    print('Erreurs console :'); [print('  ', e) for e in errors]
    sys.exit(1)
