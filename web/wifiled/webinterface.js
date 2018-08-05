var fragments = {
    "main": "<form action=\"/led\">\n" +
    "    <label for=\"r\">Red</label>\n" +
    "    <input type=\"number\" \"min\"=\"0\" \"max\"=\"255\" name=\"r\" value=\"255\" />\n" +
    "    <br/>" +
    "    <label for=\"g\">Green</label>\n" +
    "    <input type=\"number\" \"min\"=\"0\" \"max\"=\"255\" name=\"g\" value=\"255\" />\n" +
    "    <br/>" +
    "    <label for=\"b\">Blue</label>\n" +
    "    <input type=\"number\" \"min\"=\"0\" \"max\"=\"255\" name=\"b\" value=\"255\" />\n" +
    "    <br/>" +
    "    <input type=\"checkbox\" name=\"default\" value=\"default\" /><label for=\"default\"> Set as default color</label>" +
    "    <br/>" +
    "    <input type=\"submit\" value=\"Set\" />\n" +
    "</form>"
};

function setFragment(name) {
    var body = document.querySelector("body");
    body.innerHTML = fragments[name];
}

function loadMain() {
    setFragment("main");
}

document.addEventListener('DOMContentLoaded', loadMain);