const KEY = "moe-menu-v1";
const $ = (id) => document.getElementById(id);
let state = loadState();
let selectedRecipeId = null;
let toastTimer;

function loadState(){
  try {
    const data=JSON.parse(localStorage.getItem(KEY)) || {};
    const recipes=Array.isArray(data.recipes)?data.recipes:[];
    const oldPantry=data.pantry&&typeof data.pantry==="object"?data.pantry:{};
    const pantry={};
    for(const [oldKey,value] of Object.entries(oldPantry)){
      const name=oldKey.includes("|")?oldKey.slice(0,oldKey.lastIndexOf("|")):oldKey;
      const key=productKey(name);
      const had=!!value?.checked || Number(value?.amount)>0;
      if(key && (had || !pantry[key])) pantry[key]={checked:had || !!pantry[key]?.checked};
    }
    return {recipes,menu:recipes.map(r=>r.id),pantry};
  } catch { return {recipes:[],menu:[],pantry:{}}; }
}
function syncMenu(){ state.menu=state.recipes.map(r=>r.id); }
function save(){ syncMenu(); localStorage.setItem(KEY, JSON.stringify(state)); renderAll(); }
function uid(){ return crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+Math.random().toString(16).slice(2); }
function esc(s=""){ return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function toast(msg){ const el=$("toast"); el.textContent=msg; el.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),2400); }
function recipeById(id){ return state.recipes.find(r=>r.id===id); }
function unitKey(unit){ return (unit||"шт").trim().toLowerCase(); }
function productKey(name){ return (name||"").trim().toLocaleLowerCase("ru-RU").replace(/\s+/g," "); }
function formatQty(n){ return Number.isInteger(n)?String(n):String(Math.round(n*1000)/1000); }

function renderAll(){ renderRecipes(); renderMenu(); renderShopping(); renderCook(); renderOutage(); }
function renderRecipes(){
  const q=$("recipeSearch").value.trim().toLocaleLowerCase("ru-RU"), cat=$("categoryFilter").value;
  const list=state.recipes.filter(r=>(!cat||r.category===cat)&&(!q||r.name.toLocaleLowerCase("ru-RU").includes(q)));
  $("recipeGrid").innerHTML=list.map(r=>`<button class="recipe-card" data-open="${r.id}"><span class="recipe-emoji">🍲</span><span class="category-tag">${esc(r.category)}</span><h3>${esc(r.name)}</h3><span class="recipe-meta">${r.time?`◷ ${r.time} мин · `:""}${r.servings||1} порц.</span></button>`).join("");
  $("emptyRecipes").hidden=state.recipes.length>0;
  $("recipeGrid").hidden=list.length===0;
}
function renderMenu(){
  const order=["Завтраки","Обеды","Ужины","Салаты и закуски","Выпечка","Десерты","Заготовки","Другое"];
  const groups=new Map();
  for(const r of state.recipes){
    const category=order.includes(r.category)?r.category:(r.category||"Другое");
    if(!groups.has(category))groups.set(category,[]);
    groups.get(category).push(r);
  }
  const categories=[...groups.keys()].sort((a,b)=>{
    const ai=order.indexOf(a),bi=order.indexOf(b);
    return (ai<0?999:ai)-(bi<0?999:bi) || a.localeCompare(b,"ru");
  });
  $("menuList").innerHTML=categories.length?categories.map(category=>`<section class="menu-category"><h3>${esc(category)}</h3><div class="menu-category-list">${groups.get(category).sort((a,b)=>a.name.localeCompare(b.name,"ru")).map(r=>`<button class="menu-dish" data-menu-open="${r.id}">${esc(r.name)}<span>›</span></button>`).join("")}</div></section>`).join(""):'<div class="empty-state"><div class="empty-illustration">📖</div><p>Книга пока пуста. Добавь первый рецепт — он автоматически появится здесь.</p></div>';
}
function aggregateMenu(){
  const map=new Map();
  for(const id of state.menu){ const r=recipeById(id); if(!r)continue;
    for(const ing of r.ingredients||[]){
      const key=productKey(ing.name);
      if(key&&!map.has(key))map.set(key,{name:ing.name.trim(),key});
    }
  }
  return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,"ru"));
}
function renderShopping(){
  const items=aggregateMenu();
  $("shoppingList").innerHTML=items.length?items.map(it=>{
    const checked=!!state.pantry[it.key]?.checked;
    return `<label class="shopping-item"><span>${esc(it.name)}</span><input type="checkbox" data-check="${esc(it.key)}" ${checked?"checked":""} aria-label="${esc(it.name)} есть дома"></label>`;
  }).join(""):'<div class="empty-state"><div class="empty-illustration">🧺</div><p>Добавь рецепты — здесь появится общий список продуктов.</p></div>';
}
function isAvailable(r){
  return (r.ingredients||[]).every(ing=>!!state.pantry[productKey(ing.name)]?.checked);
}
function renderCook(){
  const menuRecipes=[...new Set(state.menu)].map(recipeById).filter(Boolean);
  const ready=menuRecipes.filter(isAvailable), missing=menuRecipes.filter(r=>!isAvailable(r));
  const card=r=>`<div class="list-card"><div class="grow"><strong>${esc(r.name)}</strong><small>${esc(r.category)}</small></div><button data-menu-open="${r.id}">Открыть</button></div>`;
  $("readyRecipes").innerHTML=ready.length?ready.map(card).join(""):'<p class="muted small">Пока нет блюд, для которых отмечено достаточное количество всех ингредиентов.</p>';
  $("missingRecipes").innerHTML=missing.length?missing.map(r=>{
    const absent=(r.ingredients||[]).filter(i=>!state.pantry[productKey(i.name)]?.checked).map(i=>i.name);
    return `<div class="list-card"><div class="grow"><strong>${esc(r.name)}</strong><small>Не хватает: ${esc([...new Set(absent)].join(", "))}</small></div><button data-menu-open="${r.id}">Открыть</button></div>`;
  }).join(""):'<p class="muted small">Все блюда меню можно приготовить!</p>';
}
function renderOutage(){
  const no=state.recipes.filter(r=>r.noPower), gas=state.recipes.filter(r=>r.gas);
  const card=r=>`<div class="list-card"><div class="grow"><strong>${esc(r.name)}</strong><small>${esc(r.category)}</small></div><button data-open="${r.id}">Рецепт</button></div>`;
  $("noPowerRecipes").innerHTML=no.length?no.map(card).join(""):'<p class="muted small">Пока нет отмеченных рецептов.</p>';
  $("gasRecipes").innerHTML=gas.length?gas.map(card).join(""):'<p class="muted small">Пока нет отмеченных рецептов.</p>';
}

function addIngredientRow(item={name:"",qty:"",unit:"г"}){
  const row=document.createElement("div"); row.className="ingredient-row";
  row.innerHTML=`<input class="ing-name" placeholder="Продукт" value="${esc(item.name)}" required><input class="ing-qty" type="number" min="0" step="any" placeholder="Кол-во" value="${esc(item.qty)}" required><select class="ing-unit">${["г","кг","мл","л","шт","стакан","ст. л.","ч. л.","уп.","по вкусу"].map(u=>`<option ${u===item.unit?"selected":""}>${u}</option>`).join("")}</select><button type="button" aria-label="Удалить ингредиент">×</button>`;
  row.querySelector("button").onclick=()=>row.remove(); $("ingredientRows").append(row);
}
function openNewRecipe(){ selectedRecipeId=null; $("recipeForm").reset(); $("recipeId").value=""; $("dialogTitle").textContent="Новый рецепт"; $("recipeServings").value=2; $("ingredientRows").innerHTML=""; addIngredientRow(); $("deleteRecipeBtn").hidden=true; $("recipeDialog").showModal(); }
function openEditRecipe(id){
  const r=recipeById(id); if(!r)return; selectedRecipeId=id;
  $("recipeForm").reset(); $("recipeId").value=id; $("dialogTitle").textContent="Изменить рецепт";
  $("recipeName").value=r.name; $("recipeCategory").value=r.category; $("recipeTime").value=r.time||""; $("recipeServings").value=r.servings||1; $("recipeSteps").value=r.steps||""; $("recipeNotes").value=r.notes||""; $("recipeNoPower").checked=!!r.noPower; $("recipeGas").checked=!!r.gas;
  $("ingredientRows").innerHTML=""; (r.ingredients||[]).forEach(addIngredientRow); if(!r.ingredients?.length)addIngredientRow();
  $("deleteRecipeBtn").hidden=false; $("recipeDialog").showModal();
}
function openDetail(id){
  const r=recipeById(id); if(!r)return; selectedRecipeId=id; $("detailTitle").textContent=r.name;
  const ingredients=(r.ingredients||[]).map(i=>`<li>${esc(i.name)} — ${esc(i.qty)} ${esc(i.unit)}</li>`).join("");
  $("detailContent").innerHTML=`<p class="muted">${esc(r.category)}${r.time?` · ${r.time} мин`:""}</p><div class="detail-section"><h3>Ингредиенты</h3><ul>${ingredients}</ul></div><div class="detail-section"><h3>Приготовление</h3><p>${esc(r.steps)}</p></div>${r.notes?`<div class="detail-section"><h3>Заметки</h3><p>${esc(r.notes)}</p></div>`:""}<div class="detail-section"><small class="muted">${r.noPower?"✓ Без электричества и плиты · ":""}${r.gas?"✓ Подходит газовая плита":""}</small></div>`;
  $("detailDialog").showModal();
}
function saveRecipe(ev){
  ev.preventDefault();
  const ingredients=[...$("ingredientRows").querySelectorAll(".ingredient-row")].map(row=>({name:row.querySelector(".ing-name").value.trim(),qty:Number(row.querySelector(".ing-qty").value),unit:row.querySelector(".ing-unit").value})).filter(i=>i.name);
  if(!ingredients.length){toast("Добавь хотя бы один ингредиент");return;}
  const old=selectedRecipeId?recipeById(selectedRecipeId):null;
  const r={id:selectedRecipeId||uid(),name:$("recipeName").value.trim(),category:$("recipeCategory").value,time:Number($("recipeTime").value)||0,servings:Number($("recipeServings").value)||1,ingredients,steps:$("recipeSteps").value.trim(),notes:$("recipeNotes").value.trim(),noPower:$("recipeNoPower").checked,gas:$("recipeGas").checked,created:old?.created||Date.now()};
  if(old)state.recipes=state.recipes.map(x=>x.id===r.id?r:x);else state.recipes.push(r);
  syncMenu();
  $("recipeDialog").close(); save(); toast("Рецепт сохранён");
}
function deleteRecipe(){
  if(!selectedRecipeId||!confirm("Удалить этот рецепт?"))return;
  state.recipes=state.recipes.filter(r=>r.id!==selectedRecipeId); state.menu=state.menu.filter(id=>id!==selectedRecipeId); $("recipeDialog").close(); save(); toast("Рецепт удалён");
}
function exportBackup(){
  const blob=new Blob([JSON.stringify({app:"Моё меню",version:1,exportedAt:new Date().toISOString(),...state},null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="moe-menu-backup.json";a.click();URL.revokeObjectURL(a.href);toast("Резервная копия подготовлена");
}
function importBackup(file){
  const reader=new FileReader();reader.onload=()=>{try{const data=JSON.parse(reader.result);if(!Array.isArray(data.recipes)||!Array.isArray(data.menu))throw Error();if(confirm("Заменить текущие данные резервной копией?")){state={recipes:data.recipes,menu:data.menu,pantry:data.pantry||{}};save();toast("Данные восстановлены");}}catch{toast("Не удалось прочитать эту копию");}};reader.readAsText(file);
}

document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===btn));document.querySelectorAll(".panel").forEach(x=>x.classList.toggle("active",x.id==="panel-"+btn.dataset.tab));}));
$("addRecipeBtn").onclick=openNewRecipe;$("emptyAddBtn").onclick=openNewRecipe;$("closeDialog").onclick=()=>$("recipeDialog").close();$("closeDetail").onclick=()=>$("detailDialog").close();
$("recipeForm").addEventListener("submit",saveRecipe);$("addIngredientBtn").onclick=()=>addIngredientRow();$("deleteRecipeBtn").onclick=deleteRecipe;
$("recipeSearch").oninput=renderRecipes;$("categoryFilter").onchange=renderRecipes;
$("editDetailBtn").onclick=()=>{const id=selectedRecipeId;$("detailDialog").close();openEditRecipe(id);};
$("backupBtn").onclick=()=>{const choice=confirm("Нажми ОК, чтобы скачать резервную копию. Нажми Отмена, чтобы загрузить копию из файла.");if(choice)exportBackup();else $("importFile").click();};
$("importFile").onchange=e=>{if(e.target.files[0])importBackup(e.target.files[0]);e.target.value="";};
$("clearChecksBtn").onclick=()=>{Object.values(state.pantry).forEach(x=>x.checked=false);save();toast("Отметки сняты");};
document.addEventListener("click",e=>{
  const open=e.target.closest("[data-open]");if(open)openDetail(open.dataset.open);
  const menuOpen=e.target.closest("[data-menu-open]");if(menuOpen)openDetail(menuOpen.dataset.menuOpen);
});
document.addEventListener("change",e=>{
  if(e.target.matches("[data-check]")){const key=e.target.dataset.check;state.pantry[key]={checked:e.target.checked};save();}
});
if("serviceWorker" in navigator && location.protocol!=="file:"){window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));}
renderAll();
