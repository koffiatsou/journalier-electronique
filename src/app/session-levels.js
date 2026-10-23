/* Choix du niveau : aucun niveau coché d'office, les 3 niveaux s'affichent après la sélection,
   puis seul le niveau choisi reste visible ; un appui dessus rouvre les 3 niveaux. */
(function(root){
  'use strict';
  const Q2=['Partiellement','Suffisamment','Totalement'];
  const Q4=['Aucun effet','Effet partiel','Effet positif'];
  const doc=()=>root.document;

  function isUnset(range){return !range || range.dataset.unset==='1';}

  function render(ctl,range,labels,active){
    const unset=isUnset(range);
    const open=ctl.dataset.open==='1';
    ctl.hidden=!active;
    ctl.dataset.state=!active?'off':(unset||open?'choose':'chosen');
    ctl.querySelectorAll('.lvl-opt').forEach(b=>{
      const v=Number(b.dataset.v);
      b.setAttribute('aria-pressed',String(!unset&&Number(range.value)===v));
    });
    const chip=ctl.querySelector('.lvl-chip');
    if(chip){
      const v=Number(range.value);
      chip.textContent=unset?'':labels[v];
      chip.dataset.v=String(v);
      chip.setAttribute('aria-label','Niveau choisi : '+(unset?'aucun':labels[v])+'. Appuyer pour modifier.');
    }
    const host=ctl.closest('.q2-observation-item,.q4-effect-item');
    if(host){
      host.classList.toggle('lvl-missing',active&&unset);
      host.classList.remove('lvl-0','lvl-1','lvl-2');
      if(active&&!unset)host.classList.add('lvl-'+Number(range.value));
    }
  }

  function build(range,labels,isActive,label){
    const d=doc();
    const ctl=d.createElement('span');
    ctl.className='lvl';
    ctl.setAttribute('role','group');
    ctl.setAttribute('aria-label','Niveau'+(label?' : '+label:''));
    labels.forEach((t,i)=>{
      const b=d.createElement('button');
      b.type='button';b.className='lvl-opt';b.dataset.v=String(i);b.textContent=t;
      ctl.appendChild(b);
    });
    const chip=d.createElement('button');
    chip.type='button';chip.className='lvl-chip';
    ctl.appendChild(chip);
    const sync=()=>render(ctl,range,labels,isActive());
    ctl.addEventListener('click',e=>{
      const btn=e.target.closest('button');
      if(!btn)return;
      e.preventDefault();e.stopPropagation();
      if(btn.classList.contains('lvl-chip')){ctl.dataset.open='1';sync();return;}
      range.value=btn.dataset.v;
      delete range.dataset.unset;
      ctl.dataset.open='0';
      range.dispatchEvent(new root.Event('input',{bubbles:true}));
      sync();
    });
    ctl.sync=sync;
    range.__lvl=ctl;
    sync();
    return ctl;
  }

  function resetRange(range){
    range.dataset.unset='1';range.value='1';
    if(range.__lvl)range.__lvl.dataset.open='0';
  }

  function mountQ2Item(item){
    const cb=item.querySelector('input[type="checkbox"]');
    const range=item.querySelector('input[type="range"]');
    if(!cb||!range||range.__lvl)return;
    resetRange(range);
    const label=item.querySelector('.q2-observation-label')?.textContent||'';
    const ctl=build(range,Q2,()=>cb.checked,label);
    item.appendChild(ctl);
    cb.addEventListener('change',()=>{
      if(!cb.checked)resetRange(range);
      ctl.sync();
    });
  }

  function syncQ2(){
    doc().querySelectorAll('.q2-observation-item').forEach(item=>{
      const cb=item.querySelector('input[type="checkbox"]');
      const range=item.querySelector('input[type="range"]');
      if(!cb||!range)return;
      if(!range.__lvl){mountQ2Item(item);}
      if(!cb.checked)resetRange(range);
      range.__lvl&&range.__lvl.sync();
    });
  }

  function initQ2(){
    doc().querySelectorAll('.q2-observation-item').forEach(mountQ2Item);
    const form=doc().getElementById('observationForm');
    if(form)form.addEventListener('reset',()=>root.setTimeout(syncQ2,0));
  }

  /* Aides (Q4) : un niveau d'effet par aide cochée, sans valeur par défaut. */
  function buildEffect(range,label,preset){
    if(preset===undefined||preset===null||preset==='')resetRange(range);
    else{range.value=String(preset);delete range.dataset.unset;}
    return build(range,Q4,()=>true,label);
  }

  /* Niveaux manquants : liste des libellés à compléter avant l'enregistrement. */
  function missing(){
    const out=[];
    doc().querySelectorAll('.q2-observation-item').forEach(item=>{
      const cb=item.querySelector('input[type="checkbox"]');
      const range=item.querySelector('input[type="range"]');
      if(cb&&cb.checked&&isUnset(range))out.push({el:item,label:item.querySelector('.q2-observation-label')?.textContent||''});
    });
    doc().querySelectorAll('#q4-effect-sliders .q4-effect-item').forEach(item=>{
      const range=item.querySelector('input[type="range"]');
      if(range&&isUnset(range))out.push({el:item,label:item.dataset.type||''});
    });
    return out;
  }

  const api={Q2,Q4,initQ2,syncQ2,buildEffect,missing,isUnset};
  root.JournalierLevels=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(doc()){
    if(doc().readyState==='loading')doc().addEventListener('DOMContentLoaded',initQ2);
    else initQ2();
  }
})(typeof window!=='undefined'?window:globalThis);
