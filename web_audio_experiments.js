"use strict";

const audioContext = new AudioContext();

const audioElem = document.querySelector('audio');
const track = audioContext.createMediaElementSource(audioElem);

const playButton = document.getElementById('playBtn');

audioElem.addEventListener('ended', () => {
    playButton.dataset.playing = 'false';
}, false);

const gainNodeL = audioContext.createGain();
const gainNodeR = audioContext.createGain();
const volumeControlL = document.getElementById('volumeL');
const volumeControlR = document.getElementById('volumeR');

gainNodeL.gain.value = volumeControlL.value;
volumeControlL.addEventListener('input', function() {
    gainNodeL.gain.value = this.value;
}, false);

gainNodeR.gain.value = volumeControlR.value;
volumeControlR.addEventListener('input', function() {
    gainNodeR.gain.value = this.value;
}, false);

const pannerNode = new StereoPannerNode(audioContext, { pan: 0 });
const pannerControl = document.getElementById('panner');

pannerControl.addEventListener('input', function() {
    pannerNode.pan.value = this.value;
}, false);

const splitNode = audioContext.createChannelSplitter(2);
const mergeLRNode = audioContext.createChannelMerger(2);
const analyserNode = audioContext.createAnalyser();

const filterTypeElem = document.getElementById('filterType');
const filterFrequencyElem = document.getElementById('filterFrequency');
const filterDetuneElem = document.getElementById('filterDetune');
const filterQualityElem = document.getElementById('filterQuality');
const filterGainElem = document.getElementById('filterGain');

const frequencyFilterNode = audioContext.createBiquadFilter();
const originalAnalyserNode = audioContext.createAnalyser();
track.connect(originalAnalyserNode);

filterFrequencyElem.addEventListener('input', function() {
	frequencyFilterNode.frequency.value = this.value;
});

filterDetuneElem.addEventListener('input', function() {
	frequencyFilterNode.detune.value = this.value;
});

filterQualityElem.addEventListener('input', function() {
	frequencyFilterNode.Q.value = this.value;
});

filterGainElem.addEventListener('input', function() {
	frequencyFilterNode.gain.value = this.value;
});

track.connect(splitNode);

splitNode
	.connect(gainNodeL, /*L*/0)
	.connect(mergeLRNode, 0, /*L*/0);
	
splitNode
	.connect(gainNodeR, /*R*/1)
	.connect(mergeLRNode, 0, /*R*/1);
	
mergeLRNode
	.connect(pannerNode)
	.connect(audioContext.destination);
	
const fftSizeElem = document.getElementById('fftSize');
analyserNode.fftSize = parseInt(fftSizeElem.value);
originalAnalyserNode.fftSize = analyserNode.fftSize;

const maxDrawSamplesElem = document.getElementById('maxDrawSamples');
const maxDrawLinesElem = document.getElementById('maxDrawLines');

const waveformCanvasElem = document.getElementById('waveformCanvas');

const WaveformChart = function (canvasElem, analyserNode) {
	var animationHandle;
	return {
		width: canvasElem.width,
		height: canvasElem.height,
		canvasCtx: canvasElem.getContext('2d'),
		data: undefined,
		maxDrawSpanY: undefined,
		maxDrawSpanX: undefined,
		drawSpanX: undefined,
		drawSpanY: undefined,
		y: undefined,
		options: {
			clearCanvas: true
		},
		isActive: false,
		start: function() {
			this.reset();
			this.isActive = true;
			this.draw();
		},
		stop: function() {
			this.isActive = false;
			if (animationHandle) {
				window.cancelAnimationFrame(animationHandle);
				animationHandle = null;
			}
		},
		reset: function() {
			this.data = new Uint8Array(analyserNode.frequencyBinCount);
			this.maxDrawSpanY = parseInt(maxDrawLinesElem.value);
			this.maxDrawSpanX = parseInt(maxDrawSamplesElem.value) / this.maxDrawSpanY,
			this.drawSpanX = 0;
			this.drawSpanY = 0;
			this.y = 0;
		},
		lineStrokeStyle: function() {
			return 'rgb(' + (255 * this.drawSpanX / this.maxDrawSpanX) + ', 0, ' + (255 * this.drawSpanY / this.maxDrawSpanY) + ')';
		},
		draw: function() {
			if (this.isActive) {
				animationHandle = window.requestAnimationFrame(this.draw.bind(this));
			}
			
			analyserNode.getByteTimeDomainData(this.data);

			if (this.options.clearCanvas && this.drawSpanX == 0 && this.drawSpanY == 0) {
				this.canvasCtx.fillStyle = 'rgb(200, 200, 200)';
				this.canvasCtx.fillRect(0, 0, this.width, this.height);
			}
			
			this.canvasCtx.lineWidth = 1;
			this.canvasCtx.strokeStyle = this.lineStrokeStyle();
			this.canvasCtx.beginPath();
			
			const sliceWidth = (this.width / this.maxDrawSpanX) * 1.0 / this.data.length;
			var x = this.drawSpanX * this.width / this.maxDrawSpanX;
			
			if (this.drawSpanX > 0) {
				this.canvasCtx.moveTo(x - sliceWidth, this.y);
			}
			
			for(var i = 0; i < this.data.length; i++) {
		
				const v = this.data[i] / 128.0;
				this.y = (this.drawSpanY * this.height/ this.maxDrawSpanY) + v * (this.height / this.maxDrawSpanY) / 2;

				if (i === 0 && this.drawSpanX == 0) {
				this.canvasCtx.moveTo(x, this.y);
				} else {
				this.canvasCtx.lineTo(x, this.y);
				}

				x += sliceWidth;
			}
			
			this.canvasCtx.stroke();

			this.drawSpanX++;
			if (this.drawSpanX >= this.maxDrawSpanX) {
				this.drawSpanX = 0;
				this.drawSpanY++;
				if (this.drawSpanY >= this.maxDrawSpanY) {
					this.drawSpanY = 0;
				}
			}
		}
	};
};


const frequencyCanvasElem = document.getElementById('frequencyBarCanvas');

const FrequencyBarChart = function (canvasElem, analyserNode) {
	var animationHandle;
	var mouseMoveHandler, mouseUpHandler, mouseDownHandler;
	return {
		scaleX: 1,
		startX: undefined,
		canvasCtx: canvasElem.getContext('2d'),
		width: undefined,
		height: undefined,
		data: undefined,
		barUnitWidth: undefined,
		barUnitSpacingWidth: undefined,
		options: {
			drawLabels: true,
			clearCanvas: true,
			logScale: false
		},
		isActive: false,
		start: function() {
			this.reset();
			this.isActive = true;
			this.draw();

			var isDragging = false;

			canvasElem.addEventListener('mousedown', mouseDownHandler = () => {
				isDragging = true;
			});
			
			canvasElem.addEventListener('mousemove', mouseMoveHandler = evt => {
				if (isDragging) {
					this.startX = Math.min(0, this.startX + evt.movementX);
				}
			});

			canvasElem.addEventListener('mouseup', mouseUpHandler = () => {
				isDragging = false;
			});
		},
		stop: function() {
			this.isActive = false;
			if (animationHandle) {
				window.cancelAnimationFrame(animationHandle);
				animationHandle = null;
			}

			canvasElem.removeEventListener('mousemove', mouseMoveHandler);
			canvasElem.removeEventListener('mouseup', mouseUpHandler);
			canvasElem.removeEventListener('mousedown', mouseDownHandler);
		},
		reset: function() {
			this.data = new Uint8Array(analyserNode.frequencyBinCount);
			this.width = canvasElem.width / this.scaleX;
			this.height = canvasElem.height;

			this.startX = 0;

			const spacingTotalWidth = this.width / 10;
			this.barUnitWidth = (this.width - spacingTotalWidth) / this.data.length;
			this.barUnitSpacingWidth = spacingTotalWidth / (this.data.length - 1);
		},
		barFillStyle: function (barIdx) {
			return 'rgb(' + (this.data[barIdx] / 2 + 150) + ', 0, 0)';
		},
		draw: function() {
			if (this.isActive) {
				animationHandle = window.requestAnimationFrame(this.draw.bind(this));
			}
			
			analyserNode.getByteFrequencyData(this.data);
			
			if (this.options.clearCanvas) {
				this.canvasCtx.fillStyle = 'rgb(0, 0, 0)';
				this.canvasCtx.fillRect(0, 0, canvasElem.width, canvasElem.height);
			}
			
			const maxFrequency = analyserNode.context.sampleRate / 2;
			const maxDataVisibleInCanvas = Math.round(canvasElem.width / (this.barUnitWidth + this.barUnitSpacingWidth));
			var x = this.startX;
			var prevFrequency = 1;
			var barHeight, y, lastLabelEndX;

			for (var i = 0; i < this.data.length; i++) {
				barHeight = this.data[i] / 2;
				y = this.height - barHeight;

				const frequency = maxFrequency * (i + 1) / this.data.length;
				var barWidth = this.barUnitWidth;
				var barSpacingWidth = this.barUnitSpacingWidth;

				if (this.options.logScale) {
					const exponentScalingFactor = 12 * (Math.log2(frequency) - Math.log2(prevFrequency));
					barWidth = this.barUnitWidth * exponentScalingFactor;
					barSpacingWidth = this.barUnitSpacingWidth * Math.min(1, exponentScalingFactor);
				}

				if (x >= canvasElem.width) {
					// no longer visible inside canvas, no use in drawing
					break;
				}

				this.canvasCtx.fillStyle = this.barFillStyle(i);
				this.canvasCtx.fillRect(x, y, barWidth, barHeight);
				
				if (this.options.drawLabels) {
					const label = Math.round(frequency) + 'Hz';
					const labelWidth = this.canvasCtx.measureText(label).width;
					const labelCenterX = x + barWidth / 2;
					const labelStartX = labelCenterX - labelWidth / 2;

					if (lastLabelEndX === undefined || labelStartX - lastLabelEndX >= 20) {
						lastLabelEndX = labelStartX + labelWidth;

						this.canvasCtx.fillStyle = 'white';
						this.canvasCtx.textAlign = 'center';
						this.canvasCtx.fillText(label, labelCenterX, y - 20);

					}
				}
				
				x += barWidth + barSpacingWidth;
				prevFrequency = frequency;
			}
		}
	};
};

const waveformChart = new WaveformChart(waveformCanvasElem, analyserNode);

const originalWaveformChart = new WaveformChart(waveformCanvasElem, originalAnalyserNode);
originalWaveformChart.lineStrokeStyle = function () { return 'darkgreen'; };

const frequencyBarChart = new FrequencyBarChart(frequencyCanvasElem, analyserNode);

const originalFreqBarChart = new FrequencyBarChart(frequencyCanvasElem, originalAnalyserNode);
originalFreqBarChart.barFillStyle = function (barIdx) { return 'gray'; };

const charts = [waveformChart, frequencyBarChart];

maxDrawSamplesElem.addEventListener('input', function() {
	charts.forEach(chart => chart.reset());
});

maxDrawLinesElem.addEventListener('input', function() {
	charts.forEach(chart => chart.reset());
});

fftSizeElem.addEventListener('change', function() {
	const logBase2 = Math.log2(parseInt(this.value));
	
	if (analyserNode.fftSize < this.value) {
		analyserNode.fftSize = Math.pow(2, Math.ceil(logBase2));
	} else {
		analyserNode.fftSize = Math.pow(2, Math.floor(logBase2));
	}
	originalAnalyserNode.fftSize = analyserNode.fftSize;
	
	charts.forEach(chart => chart.reset());

	this.value = analyserNode.fftSize;
});

playButton.addEventListener('click', function () {
	if (audioContext.state == 'suspended') {
		audioContext.resume();
	}
	
	if (this.dataset.playing === 'false') {
		audioElem.play();
		this.dataset.playing = 'true';
		
		pannerNode.connect(analyserNode);
		
		charts.forEach(chart => chart.start());
		
		playButton.innerHTML = 'Pause';
	} else if (this.dataset.playing === 'true') {
		audioElem.pause();
		this.dataset.playing = 'false';
		
		charts.forEach(chart => chart.stop());
		
		pannerNode.disconnect(analyserNode);
		
		playButton.innerHTML = 'Play';
	}
}, false);

const freqChartScaleElems = document.getElementsByName('freqChartScale');
for (const elem of freqChartScaleElems) {
	elem.addEventListener('input', function () {
		if (this.checked) {
			const useLogScale = this.value === 'log';
			frequencyBarChart.options.logScale = useLogScale;
			originalFreqBarChart.options.logScale = useLogScale;
		}
	});
	elem.dispatchEvent(new Event('input'));
}

const audioFileElem = document.getElementById('audioFile');
audioFileElem.addEventListener('change', function() {
	const file = URL.createObjectURL(this.files[0]);
	audioElem.src = file;
	
	if (playButton.dataset.playing === 'true') {
		audioElem.play();
	}
});

const recordBtn = document.getElementById('recordBtn');
var recordingStream = null;
var recordingSource = null;

recordBtn.addEventListener('click', function() {
	if (recordingSource) {
		recordingSource.mediaStream.getAudioTracks().forEach(function (track) { track.stop(); });
		recordingSource.disconnect(analyserNode);
		recordingSource = null;
		
		charts.forEach(chart => chart.stop());

		recordBtn.innerHTML = 'Record';
	} else {
		navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(function (stream) {
			recordingSource = audioContext.createMediaStreamSource(stream);
			recordingSource.connect(analyserNode);
			
			if (audioContext.state == 'suspended') {
				audioContext.resume();
			}
			
			charts.forEach(chart => chart.start());
			
			recordBtn.innerHTML = 'Recording...';
		});
	}
});

const zoomInElem = document.getElementById('zoomInBtn');
zoomInElem.addEventListener('click', function () {
	frequencyBarChart.scaleX /= 2;
	frequencyBarChart.reset();

	originalFreqBarChart.scaleX = frequencyBarChart.scaleX;
	originalFreqBarChart.reset();
});

const zoomOutElem = document.getElementById('zoomOutBtn');
zoomOutElem.addEventListener('click', function () {
	frequencyBarChart.scaleX *= 2;
	frequencyBarChart.reset();

	originalFreqBarChart.scaleX = frequencyBarChart.scaleX;
	originalFreqBarChart.reset();
});

const zoomResetElem = document.getElementById('zoomResetBtn');
zoomResetElem.addEventListener('click', function () {
	frequencyBarChart.scaleX = 1;
	frequencyBarChart.reset();

	originalFreqBarChart.scaleX = 1;
	originalFreqBarChart.reset();
});

filterTypeElem.addEventListener('change', function() {
	if (filterTypeElem.value === '' && this.dataset.filtering == 'true') {
		track.disconnect(frequencyFilterNode);
		frequencyFilterNode.disconnect(splitNode);
		track.connect(splitNode);

		filterFrequencyElem.parentElement.classList = 'hidden';
		filterDetuneElem.parentElement.classList = 'hidden';
		filterQualityElem.parentElement.classList = 'hidden';
		filterGainElem.parentElement.classList = 'hidden';

		// remove original data charts
		charts.splice(0, /*deleteCount*/2).forEach(chart => chart.stop());

		// re-setup regular chart options
		waveformChart.options.clearCanvas = true;
		frequencyBarChart.options.drawLabels = true;
		frequencyBarChart.options.clearCanvas = true;
		
		this.dataset.filtering = false;
	} else {
		frequencyFilterNode.type = filterTypeElem.value;

		if (this.dataset.filtering == 'false') {
			filterFrequencyElem.value = frequencyFilterNode.frequency.value;
			filterDetuneElem.value = frequencyFilterNode.detune.value;
			filterQualityElem.value = frequencyFilterNode.Q.value;
			filterGainElem.value = frequencyFilterNode.gain.value;	

			track.disconnect(splitNode);
			track.connect(frequencyFilterNode).connect(splitNode);

			filterFrequencyElem.parentElement.classList = '';
			filterDetuneElem.parentElement.classList = '';

			var chartsWereActive = charts.some(c => c.isActive);
			
			// add original data charts
			// regular charts need to be reset as well, so both are in sync in terms of drawing
			charts.forEach(chart => chart.stop());
			charts.unshift(originalWaveformChart, originalFreqBarChart);

			// re-setup regular chart options
			waveformChart.options.clearCanvas = false;
			frequencyBarChart.options.drawLabels = false;
			frequencyBarChart.options.clearCanvas = false;

			if (chartsWereActive) {
				charts.forEach(chart => chart.start());
			}
			
			this.dataset.filtering = true;
		}

		if (['lowshelf', 'highshelf'].indexOf(filterTypeElem.value) >= 0) {
			filterQualityElem.parentElement.classList = 'hidden';
		} else {
			filterQualityElem.parentElement.classList = '';
		}

		if (['lowshelf', 'highshelf', 'peaking'].indexOf(filterTypeElem.value) >= 0) {
			filterGainElem.parentElement.classList = '';
		} else {
			filterGainElem.parentElement.classList = 'hidden';
		}
	} 
});