const steps = [...document.querySelectorAll('[data-step]')];
const progress = [...document.querySelectorAll('#progress li')];
const deployOptions = document.querySelector('#deploy-options');
const instructions = [...document.querySelectorAll('[data-method]')];
const back = document.querySelector('#back');
const next = document.querySelector('#next');
let step = 0;

function showMethod() {
  const method = deployOptions.querySelector('input:checked').value;
  for (const instruction of instructions) {
    instruction.hidden = instruction.dataset.method !== method;
  }
}

function showStep() {
  steps.forEach((section, index) => { section.hidden = index !== step; });
  progress.forEach((item, index) => {
    if (index === step) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
  });
  back.hidden = step === 0;
  next.hidden = step === steps.length - 1;
}

function move(change) {
  step += change;
  showStep();
  steps[step].querySelector('h2').focus();
}

deployOptions.addEventListener('change', showMethod);
back.addEventListener('click', () => move(-1));
next.addEventListener('click', () => move(1));
showMethod();
showStep();
deployOptions.hidden = false;
document.querySelector('#update-progress').hidden = false;
document.querySelector('#update-navigation').hidden = false;
