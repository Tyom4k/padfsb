// SPEEDOMETER BY MATVEY TABLETKA 
let state = 
{
  speed: 0,
  maxSpeed: 300,
  fuelValue: 100,
  fuelCapacity: 100,
  strength: 1000,
  mileage: 0,
};

// ˜˜˜˜˜˜˜˜
const speedValue = document.querySelector('.speed-value');
const mileageValue = document.querySelector('.mileage-value');
const arrowAnchor = document.querySelector('.arrow__anchor');
const fuelBar = document.querySelector('.fuel-bar .bar');
const strengthBar = document.querySelector('.strength-bar .bar');

// ˜˜˜˜˜˜˜˜ ˜˜˜˜˜˜˜˜˜˜ ˜˜˜˜˜ (˜˜˜˜˜˜˜˜)
let indicators = document.querySelectorAll('.scale__indicators .indicator');

function map(value, inMin, inMax, outMin, outMax) {
  if (inMax === inMin) return outMin;
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

function drawCircleProgressBar(canvas, progress, angle, strokeWidth, strokeColor, progressColor, clockwise = false) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const startAngle = Math.PI * 1.5;
  const maxAngle = (Math.PI * 2 * angle) / 360;
  const progressAngle = (maxAngle * progress) / 100;

  ctx.clearRect(0, 0, size, size);

  // Background stroke
  ctx.beginPath();
  ctx.arc(center, center, radius, startAngle, startAngle + maxAngle, clockwise);
  ctx.lineWidth = strokeWidth;
  ctx.strokeStyle = strokeColor;
  ctx.stroke();

  // Progress stroke
  ctx.beginPath();
  ctx.arc(center, center, radius, startAngle, startAngle + progressAngle, clockwise);
  ctx.lineWidth = strokeWidth;
  ctx.strokeStyle = progressColor;
  ctx.stroke();
}

function updateSpeedometer() {
  // Update Speed Value
  if (speedValue) speedValue.textContent = Math.round(state.speed);

  // Update Mileage
  if (mileageValue) mileageValue.textContent = String(Math.round(state.mileage)).padStart(6, '0');

  // Update Speed Scale Needle
  if (arrowAnchor) {
    const rotation = map(state.speed, 0, state.maxSpeed, 0, 158);
    arrowAnchor.style.transform = `rotate(${rotation}deg)`;
  }

  // Update Scale Indicators (Dashes)
  if (indicators.length > 0) {
    const step = state.maxSpeed / indicators.length;
    const fullIndicators = Math.floor(state.speed / step);
    const partialIndicator = (state.speed % step) / step;
    
    indicators.forEach((indicator, index) => {
      if (index < fullIndicators) {
        indicator.style.opacity = 1;
      } else if (index === fullIndicators) {
        indicator.style.opacity = Math.max(0, Math.min(partialIndicator, 1));
      } else {
        indicator.style.opacity = 0.3; // ˜˜˜˜˜˜˜˜˜˜˜˜˜˜ ˜˜˜ ˜˜˜˜˜˜˜˜˜˜
      }
    });
  }
  
  // Update Fuel Bar
  if (fuelBar) {
    const fuelProgress = (state.fuelValue / state.fuelCapacity) * 100;
    drawCircleProgressBar(fuelBar, fuelProgress, 48, 5, 'rgba(255, 255, 255, 0.3)', '#F3BE00', false);
  }

  // Update Strength Bar
  if (strengthBar) {
    const strengthProgress = map(state.strength, 333, 1000, 0, 100);
    drawCircleProgressBar(strengthBar, strengthProgress, 32, 5, 'rgba(255, 255, 255, 0.3)', '#FFFFFF', false);
  }
}

function updateBar(type, value) {
    if (type === 'fuel') {
      state.fuelValue = Math.max(0, Math.min(value, state.fuelCapacity));
    } else if (type === 'strength') {
      state.strength = Math.max(0, Math.min(value, 1000));
    }
    updateSpeedometer();
}
  
function toggleSpeedometer(f) {
  const speedometer = document.querySelector('.speedometer');
  if (!speedometer) return;
  speedometer.style.display = (f == 1) ? 'block' : 'none';
}

// ˜˜˜˜˜˜˜˜˜˜˜ ˜˜˜˜˜˜˜ ˜˜ ˜˜˜˜˜˜˜
cef.on("game:SetSpeed", (speed, mileage) => {
    state.speed = Math.min(speed, state.maxSpeed);
    state.mileage = mileage;
    updateSpeedometer();
});

cef.on("game:SetSpeedFuel", (fuel) => {
    state.fuelValue = fuel;
    updateSpeedometer();
});

cef.on("game:SetSpeedHealth", (health) => {
    state.strength = health;
    updateSpeedometer();
});

cef.on("game:SetSpeedEngine", (engine) => {
    const icon = document.querySelector('.engine-indicator .icon');
    if (icon) icon.style.color = engine ? '#69da67' : '#ffffff4d'; // ˜˜˜˜-˜˜˜˜˜˜˜ (˜˜˜) / ˜˜˜˜˜˜˜ (˜˜˜˜)
});

cef.on("game:SetSpeedDoors", (doors) => {
    const icon = document.querySelector('.doors-indicator .icon');
    if (icon) icon.style.color = doors ? '#ff4d4d' : '#ffffff4d'; // ˜˜˜˜˜˜˜ (˜˜˜˜˜˜˜) / ˜˜˜˜˜˜˜ (˜˜˜˜˜˜˜)
});

cef.on("game:SetSpeedLights", (lights) => {
    const icon = document.querySelector('.headlights-indicator .icon');
    if (icon) icon.style.color = lights ? '#3498db' : '#ffffff4d'; // ˜˜˜˜˜/˜˜˜˜˜˜˜ (˜˜˜) / ˜˜˜˜˜˜˜ (˜˜˜˜)
});

cef.on("game:SetSpeedStage", (stage) => {
    const stageElement = document.querySelector('.staging-indicator .stage');
    const stageIcon = document.querySelector('.staging-indicator .icon');
    if (stageElement && stageIcon) {
        stageElement.textContent = stage;
        stageElement.style.opacity = stage > 0 ? 1 : 0;
        stageIcon.style.color = stage > 0 ? '#ffd232' : '#ffffff4d';
    }
});

cef.on("game:ToggleSpeedometer", (show) => {
    toggleSpeedometer(show ? 1 : 0);
});

// ˜˜˜˜˜˜˜˜˜˜˜˜˜ ˜˜˜ ˜˜˜˜˜˜˜˜
document.addEventListener('DOMContentLoaded', function() {
    // ˜˜˜˜˜˜˜˜˜˜˜˜ ˜˜˜˜˜˜ ˜˜˜˜˜˜˜˜˜˜˜ ˜˜˜˜˜ ˜˜˜˜˜˜˜˜ DOM
    indicators = document.querySelectorAll('.scale__indicators .indicator');
    updateSpeedometer();
});

// ˜˜˜˜˜˜˜ ˜˜˜ ˜˜˜˜˜˜˜ ˜˜˜˜˜˜˜˜˜˜˜˜
window.testSpeedometer = function(speed = 100, fuel = 50, strength = 750) {
    state.speed = speed;
    state.fuelValue = fuel;
    state.strength = strength;
    updateSpeedometer();
};

console.log('Speedometer script loaded');
