const dgram = require('dgram');
const client = dgram.createSocket('udp4');

const maxCommandLength = 80;

const mspf = 1000/30;

function wait(delay) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, delay);
    })
}

class WiFiLedClient {
    constructor(ip, port, numberOfLeds) {
        this.ip = ip;
        this.port = port;
        this.numberOfLeds = 240;
        this.lastState = new Array(numberOfLeds).fill([0,0,0]);
    }

    send(offset, refresh, colors) {
        return new Promise((resolve, reject) => {
            let buffer = new Buffer(5 + colors.length * 3);
            buffer[0] = (offset & 0xff);
            buffer[1] = (offset & 0xff00) >> 8;
            buffer[2] = (colors.length & 0xff);
            buffer[3] = (colors.length & 0xff00) >> 8;
            buffer[4] = refresh ? 0xff : 0x00;

            for (let i = 0; i < colors.length; i++) {
                buffer[5 + i * 3 + 0] = colors[i][0];
                buffer[5 + i * 3 + 1] = colors[i][1];
                buffer[5 + i * 3 + 2] = colors[i][2];
            }
            client.send(buffer, this.port, this.ip, resolve);
        });
    }

    setColors(offset, refresh, colors) {
        let i = 0;

        for(let j=offset, l=offset+colors.length;j<l;j++) {
            this.lastState[j] = colors[j - offset];
        }

        let next = () => {
            return this.send(i + offset, refresh && (i + maxCommandLength >= colors.length), colors.slice(i, Math.min(colors.length, i + maxCommandLength))).then(() => {
                i += maxCommandLength;
                if (i < colors.length) {
                    return next();
                } else {
                    return;
                }
            });
        };

        return next();
    }

    fadeColors(delay, steps, beginColors, endColors) {
        return new Promise((resolve, reject) => {
            let step = 0;
            let interval = setInterval(() => {
                function interpolate(a, b) {
                    return a + (step / (steps - 1)) * (b - a);
                }

                let newColors = beginColors.map((beginColor, index) => {
                    let endColor = endColors[index];
                    return [
                        interpolate(beginColor[0], endColor[0]),
                        interpolate(beginColor[1], endColor[1]),
                        interpolate(beginColor[2], endColor[2])
                    ]
                });

                this.setColors(0, true, newColors);

                if(++step == step) {
                    clearInterval(interval);
                    resolve();
                }
            })
        });
    }

    fade(delay, steps, beginColor, endColor, offset, numberOfLeds) {
        if(offset === undefined) offset = 0;
        if(numberOfLeds === undefined) numberOfLeds = this.numberOfLeds;

        return new Promise((resolve, reject) => {
            let step = 0;
            let interval = setInterval(() => {
                function interpolate(a, b) {
                    return a + (step / (steps - 1)) * (b - a);
                }

                let color = [
                    interpolate(beginColor[0], endColor[0]),
                    interpolate(beginColor[1], endColor[1]),
                    interpolate(beginColor[2], endColor[2])
                ];

                this.setColors(offset, true, Array(numberOfLeds).fill(color));

                if (++step == steps) {
                    clearInterval(interval);
                    resolve();
                }
            }, delay);
        });
    }

    wipe(delay, stepsPerLed, stepsBetweenLeds, beginColor, endColor) {
        return new Promise((resolve, reject) => {
            let step = 0;
            let interval = setInterval(() => {

                let newColors = new Array(this.numberOfLeds).fill(0).map((el, index) => {
                    let ledStep = Math.min(Math.max(0, (step / stepsBetweenLeds) - index), stepsPerLed - 1);
                    function interpolate(a, b) {
                        return a + (ledStep / (stepsPerLed - 1)) * (b - a);
                    }
                    return [
                        interpolate(beginColor[0], endColor[0]),
                        interpolate(beginColor[1], endColor[1]),
                        interpolate(beginColor[2], endColor[2])
                    ];
                });

                this.setColors(0, true, newColors);

                if (++step == stepsBetweenLeds * this.numberOfLeds + stepsPerLed) {
                    clearInterval(interval);
                    resolve();
                }
            }, delay);
        })
    }

    fadeTo(colorArray, delay=1000) {
        let beginState = this.lastState.slice(),
            beginTime = new Date().getTime();
        return new Promise((resolve, reject) => {
            let interval = setInterval(() => {
                let time = new Date().getTime(),
                    dur = time - beginTime,
                    pct = Math.min(1, dur / delay);

                function interpolate(a, b) {
                    return a + (b-a) * pct;
                }

                let targetColors = beginState.map((color, index) => [interpolate(color[0], colorArray[index % colorArray.length][0]),interpolate(color[1], colorArray[index % colorArray.length][1]),interpolate(color[2], colorArray[index % colorArray.length][2])]);
                this.setColors(0, true, targetColors);
                if(pct >= 1) {
                    clearInterval(interval);
                    resolve();
                }
            }, mspf);
        });
    }
}

function repeat(what, count) {
    return new Array(count).fill(what);
}

function play(arr, repeat) {
    return new Promise((resolve, reject) => {
        let i = 0;
        function next() {
            if(i == arr.length && !repeat) {
                resolve();
            } else {
                if(i == arr.length) {
                    i = 0;
                }
                arr[i++]().then(next).catch(reject);
            }
        }

        next();
    });
}

let leds = new WiFiLedClient("192.168.1.48", 2000, 300);
play([
    () => leds.wipe(5, 33, 1, [0,0,0], [255,255,255]),
    () => leds.fadeTo([[0, 0, 0]]),
    () => leds.fadeTo([[255,255,255],[0,0,0]]),
    () => leds.fadeTo([[0,0,0],[255,255,255]]),
    () => leds.fadeTo([[255,0,0],[0,255,0]]),
    () => leds.fadeTo([[0,255,0],[255,0,0]]),
    () => leds.fadeTo(repeat([0,0,255], 121).concat(repeat([255,0,0],120))),
    () => leds.fadeTo(repeat([255,0,0], 121).concat(repeat([0,0,255],120))),
    () => leds.fadeTo(repeat([0,0,255], 121).concat(repeat([255,0,0],120))),
    () => leds.fadeTo(repeat([255,0,0], 121).concat(repeat([0,0,255],120))),
    () => leds.fadeTo(repeat([0,0,255], 121).concat(repeat([255,0,0],120))),
    () => leds.fadeTo(repeat([255,0,0], 121).concat(repeat([0,0,255],120))),
    () => leds.fadeTo(repeat([0,0,255], 121).concat(repeat([255,0,0],120))),
    () => leds.fadeTo(repeat([255,0,0], 121).concat(repeat([0,0,255],120)))
], true);