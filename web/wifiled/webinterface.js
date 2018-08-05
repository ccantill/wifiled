var fragments = {
    "main": () => `
                <label for="r">Color</label>
                <input type="color" name="color" id="color"/><br/>
                <input type="button" id="setDefault" value="Set as default" />
`
};

function parseHexToObject(hex) {
    let [c, r, g, b] = hex.match(/#([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})/);
    if (c != hex) return;

    return {
        r: Number.parseInt(r, 16),
        g: Number.parseInt(g, 16),
        b: Number.parseInt(b, 16)
    };
}

function setFragment(name, events, ...args) {
    var body = document.querySelector("body");
    body.innerHTML = fragments[name](...args);
    Object.keys(events).forEach(k => {
            let [id, eventname] = k.split('.');
            let element = document.getElementById(id);
            element.addEventListener(eventname, events[k].bind(element));
        }
    )
}

let color;

function loadMain() {
    setFragment("main", {
        "color.change": function () {
            let c = parseHexToObject(this.value);
            if (c) {
                color = c;
                fetch(`/led?r=${c.r}&g=${c.g}&b=${c.b}`);
            }
        },
        "setDefault.click": function () {
            fetch(`/led?r=${color.r}&g=${color.g}&b=${color.b}&default=true`);
        }
    });
}

document.addEventListener('DOMContentLoaded', loadMain);