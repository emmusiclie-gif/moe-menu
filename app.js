const KEY = "moe-menu-v1";
const $ = (id) => document.getElementById(id);
let state = loadState();
let selectedRecipeId = null;
let toastTimer;

function loadState(){
  try {
    const data=JSON.parse(localStorage.getItem(KEY)) || {};
    const recipes=Array.isArray(data.recipes)?data.recipes:[]; for(const r of recipes){if(r.hasRecipe===undefined)r.hasRecipe=!!((r.ingredients||[]).length||(r.steps||"").trim());if(r.category==="Полуфабрикаты"){r.hasRecipe=false;r.ingredients=[{name:r.name,qty:1,unit:"шт"}];}}
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

function renderAll(){ renderRecipes(); renderMenu(); renderShopping(); renderCook(); }
function renderRecipes(){
  const q=$("recipeSearch").value.trim().toLocaleLowerCase("ru-RU"), cat=$("categoryFilter").value;
  const list=state.recipes.filter(r=>(!cat||r.category===cat)&&(!q||r.name.toLocaleLowerCase("ru-RU").includes(q)));
  $("recipeGrid").innerHTML=list.map(r=>`<button class="recipe-card" data-open="${r.id}"><span class="recipe-emoji">🍲</span><span class="category-tag">${esc(r.category)}</span><h3>${esc(r.name)}</h3><span class="recipe-meta">${r.time?`◷ ${r.time} мин · `:""}${r.servings||1} порц.</span></button>`).join("");
  $("emptyRecipes").hidden=state.recipes.length>0;
  $("recipeGrid").hidden=list.length===0;
}
function renderMenu(){
  const order=["Завтраки","Обеды","Ужины","Салаты и закуски","Выпечка","Десерты","Заготовки","Полуфабрикаты","Другое"],groups=new Map();
  for(const r of state.recipes){const c=order.includes(r.category)?r.category:(r.category||"Другое");if(!groups.has(c))groups.set(c,[]);groups.get(c).push(r);}
  const keys=[...groups.keys()].sort((a,b)=>order.indexOf(a)-order.indexOf(b));
  $("menuList").innerHTML=keys.length?keys.map(c=>'<section class="menu-category"><h3>'+esc(c)+'</h3><div class="menu-category-list">'+groups.get(c).sort((a,b)=>a.name.localeCompare(b.name,"ru")).map(r=>'<button class="menu-dish" data-menu-open="'+r.id+'"><span>'+(r.noPower?"🚫💡 ":"")+esc(r.name)+'</span><span>›</span></button>').join("")+'</div></section>').join(""):'<div class="empty-state"><p>Добавь первое блюдо в меню.</p></div>';
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

function addDishToMenu(){const name=$("menuDishName").value.trim(),category=$("menuDishCategory").value;if(!name){toast("Напиши название блюда");return;}const semi=category==="Полуфабрикаты";state.recipes.push({id:uid(),name,category,time:0,servings:1,ingredients:semi?[{name,qty:1,unit:"шт"}]:[],steps:"",notes:"",noPower:false,hasRecipe:false,created:Date.now()});$("menuDishName").value="";save();toast(semi?"Полуфабрикат добавлен":"Блюдо добавлено в меню");}
function addIngredientRow(item={name:"",qty:"",unit:"г"}){
  const row=document.createElement("div"); row.className="ingredient-row";
  row.innerHTML=`<input class="ing-name" placeholder="Продукт" value="${esc(item.name)}" required><input class="ing-qty" type="number" min="0" step="any" placeholder="Кол-во" value="${esc(item.qty)}" required><select class="ing-unit">${["г","кг","мл","л","шт","стакан","ст. л.","ч. л.","уп.","по вкусу"].map(u=>`<option ${u===item.unit?"selected":""}>${u}</option>`).join("")}</select><button type="button" aria-label="Удалить ингредиент">×</button>`;
  row.querySelector("button").onclick=()=>row.remove(); $("ingredientRows").append(row);
}
function openNewRecipe(){ selectedRecipeId=null; $("recipeForm").reset(); $("recipeId").value=""; $("dialogTitle").textContent="Новый рецепт"; $("recipeServings").value=2; $("ingredientRows").innerHTML=""; addIngredientRow(); $("deleteRecipeBtn").hidden=true; $("semiFinishedHint").hidden=true;$("recipeFields").hidden=false;$("recipeDialog").showModal(); }
function openEditRecipe(id){
 const r=recipeById(id);if(!r)return;selectedRecipeId=id;$("recipeForm").reset();$("recipeId").value=id;$("dialogTitle").textContent=r.hasRecipe?"Изменить рецепт":"Добавить рецепт к блюду";$("recipeName").value=r.name;$("recipeCategory").value=r.category;$("recipeTime").value=r.time||"";$("recipeServings").value=r.servings||1;$("recipeSteps").value=r.steps||"";$("recipeNotes").value=r.notes||"";$("recipeNoPower").checked=!!r.noPower;$("ingredientRows").innerHTML="";if(r.category!=="Полуфабрикаты")(r.ingredients||[]).forEach(addIngredientRow);if(r.category!=="Полуфабрикаты"&&!r.ingredients?.length)addIngredientRow();$("recipeFields").hidden=r.category==="Полуфабрикаты";$("semiFinishedHint").hidden=r.category!=="Полуфабрикаты";$("deleteRecipeBtn").hidden=false;$("recipeDialog").showModal();
}
function openDetail(id){const r=recipeById(id);if(!r)return;if(!r.hasRecipe&&r.category!=="Полуфабрикаты"){openEditRecipe(id);return;}selectedRecipeId=id;$("detailTitle").textContent=r.name;if(r.category==="Полуфабрикаты"){$("detailContent").innerHTML='<p class="muted">Полуфабрикат. Рецепт не требуется; название автоматически попадёт в список покупок.</p>';}else{const ingredients=(r.ingredients||[]).map(i=>'<li>'+esc(i.name)+' — '+esc(i.qty)+' '+esc(i.unit)+'</li>').join("");$("detailContent").innerHTML='<p class="muted">'+esc(r.category)+'</p><div class="detail-section"><h3>Ингредиенты</h3><ul>'+ingredients+'</ul></div><div class="detail-section"><h3>Приготовление</h3><p>'+esc(r.steps)+'</p></div>'+(r.notes?'<div class="detail-section"><h3>Заметки</h3><p>'+esc(r.notes)+'</p></div>':"");}$("detailDialog").showModal();}
function saveRecipe(ev){ev.preventDefault();const name=$("recipeName").value.trim(),category=$("recipeCategory").value,semi=category==="Полуфабрикаты";const ingredients=semi?[{name,qty:1,unit:"шт"}]:[...$("ingredientRows").querySelectorAll(".ingredient-row")].map(row=>({name:row.querySelector(".ing-name").value.trim(),qty:Number(row.querySelector(".ing-qty").value),unit:row.querySelector(".ing-unit").value})).filter(i=>i.name);if(!semi&&!ingredients.length){toast("Добавь хотя бы один ингредиент");return;}const old=selectedRecipeId?recipeById(selectedRecipeId):null;const r={id:selectedRecipeId||uid(),name,category,time:semi?0:Number($("recipeTime").value)||0,servings:Number($("recipeServings").value)||1,ingredients,steps:semi?"":$("recipeSteps").value.trim(),notes:semi?"":$("recipeNotes").value.trim(),noPower:semi?false:$("recipeNoPower").checked,hasRecipe:!semi,created:old?.created||Date.now()};if(old)state.recipes=state.recipes.map(x=>x.id===r.id?r:x);else state.recipes.push(r);$("recipeDialog").close();save();toast(semi?"Полуфабрикат сохранён":"Рецепт сохранён");}
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
$("addDishBtn").onclick=addDishToMenu;$("addRecipeBtn").onclick=openNewRecipe;$("emptyAddBtn").onclick=openNewRecipe;$("closeDialog").onclick=()=>$("recipeDialog").close();$("closeDetail").onclick=()=>$("detailDialog").close();
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
