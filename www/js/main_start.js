console.log("username " + username);

console.log("erd_name " + erd_name);

console.log("erd_id " + erd_id);

console.log("___________________");

var nickname = username.split("@")[0];

var socket = io.connect();

var w = d3.select("#erd").style("width").replace("px", "") - 20;

var h = d3.select("#erd").style("height").replace("px", "") - 20;

console.log("DImensions : "+w+"  "+h);

var t_width = (w>900)?150:Math.round(w/3);

var t_height = t_width*1.5;//(h>900)?220:Math.round(h/5);

var margin = 10;

var dragging = false;

var temp_line;

var origin_x = 0, origin_y = 0;

var target_aquired = false, target;

var start_rotation, target_rotation;

var start_position, target_position;

var link_offset = 30;

var data_obj = {
    table: [],
    shape: [],
    line: [],
    link: [],
    link_list: {},
    totals: {
        table: 0,
        shape: 0,
        line: 0
    }
};

var user_id = username;

var users = [];

var grid = [];

var table = {};

var table_count = 0;

var pathData = [ {
    x: 0,
    y: 0
}, {
    x: 0,
    y: 0
}, {
    x: 0,
    y: 0
}, {
    x: 0,
    y: 0
}, {
    x: 0,
    y: 0
} ];

var crow_symbols = [ "none", "one", "many", "one_or_many", "only_one", "zero_many", "zero_or_one", "arrow", "arrow_hollow" ];

var crow_svgs = [];

var importedNode;

var tooltip = d3.select("body").append("div").attr("id", "tooltip");

var color_palette_list = [ "#e57373", "#ba68c8", "#9575cd", "#7986cb", "#64b5f6", "#4fc3f7", "#4dd0e1", "#4db6ac", "#81c784", "#aed581", "#dce775", "#fff176", "#ffd54f", "#ffb74d", "#ff8a65", "#a1887f", "#e0e0e0", "#000000" ];

var default_color = "white";

var default_link_end = "arrow_hollow";

var selected = [];

var dragToolPosition = [];

var draggingTool = false;

var drag_offset_x, drag_offset_y;

var svg_offset = {
    x: $("#erd").offset().left,
    y: $("#erd").offset().top
};

var convert_line_to_link = null;

var line_reshaping = false;

var modal_issue_fix = false;

var ie;

function addCrow(name, i) {
    d3.xml("images/crow/" + name + ".svg", "image/svg+xml", function(xml) {
        crow_svgs.push({
            id: name,
            svg: document.importNode(xml.documentElement, true).getElementsByTagName("g")[0]
        });
        if (i == crow_symbols.length - 1) start();
    });
}

for (c in crow_symbols) {
    addCrow(crow_symbols[c], c);
}

function start() {
    ie = !msieversion() ? false : true;
    $(window).resize(function() {
        wheel();
    });
    if (login_error.length > 1) {
        login();
    } else if (typeof $.cookie("user_id") === "undefined") {
        //no cookie
        socket.emit("trial_connect", username);
        if (signup_error.length == 0) {
            /************* Intro Modal *********************/
            $("#modal").modal("open");
            $("#modal_head").text("Welcome to ERD Sketch");
            $("#modal_submit").text("Try it out");
            $("#modal_cancel").text("Create an account");
            $("#modal_content").html(function() {
                var html = "<p>This is a multi-user application for creating Entity Relationship Diagrams using Crows Foot Notation.</p>";
                html += "<p>Click or drag objects in the tool box to add them to the diagram.</p>";
                html += "<p>Link objects by dragging between the linkpoints or selecting the link tool</p>";
                html += "<p>You can invite other users to collaborate on the diagram</p>";
                if (msieversion()) {
                    html += "<p>I see you are using Internet Explorer " + msieversion() + ". I would recommend you use a good browser like Chrome or Firefox.";
                }
                return html;
            });
            d3.select("#modal_cancel").on("click", function() {
                setTimeout(function() {
                    if (!modal_issue_fix) createAccount(81);
                    $("#modal_cancel").text("Cancel").on("click", function() {
                        $("#modal").modal("close");
                    });
                }, 500);
            });
            d3.select("#modal_submit").on("click", function() {
                $("#modal_cancel").text("Cancel");
            });
        } else {
            console.log("signup error : " + signup_error);
            console.log("signup error len : " + signup_error.length);
            createAccount(90);
        }
    } else {
        // has cookie
        username = $.cookie("user_id");
        nickname = $.cookie("user_id").split("@")[0];
        console.log("nickname : " + nickname);
        login();
    }
    /*************** Log in Modal **************************************/
    function login() {
        var login_user_id = "";
        if (typeof $.cookie("user_id") != "undefined") {
            login_user_id = $.cookie("user_id");
            nickname = login_user_id.split("@")[0];
        }
        $("#modal").modal("open");
        $("#modal_head").text("Log In");
        $("#modal_submit").text("Submit");
        $("#modal_content").html(function() {
            var html = "<p>Hi " + nickname + " please login to your account.</p>";
            html += '<form id="loginForm" action="/login" method="post"><div class="input-field col s6" style="margin-top:0;"><input name="email" id="email" value="' + login_user_id + '" type="text" class="validate">';
            html += '<label class="active" for="email">Email:</label></div>';
            html += '<div class="input-field col s6" style="margin-top:0;"><input name="password" id="password" value="" type="password" class="validate">';
            html += '<label class="active" for="password">Password:</label></div>';
            html += '<p id="login_feedback">' + login_error + "</p>";
            return html;
        });
        Materialize.updateTextFields();
        d3.select("#modal_submit").on("click", function() {
            document.getElementById("loginForm").submit();
        });
    }
    /*******************************************************************/
    socket.on("signup", function(res) {
        console.log("signedup!");
        console.log(res);
        window.location.assign("/draw");
    });
    function make_field(id, name, width) {
        var obj = {
            id: id,
            name: name,
            width: width,
            primary: false,
            foreign: false
        };
        return obj;
    }
    function make_table(id, name, x, y, w, h) {
        var obj = {
            id: id,
            type: "table",
            selected: false,
            color: "black",
            name: name,
            x: x,
            y: y,
            height: h,
            width: w,
            fields: [ make_field(id + "_field_1", "Field_1", w - 20) ]
        };
        return obj;
    }
    function make_shape(id, x, y, w, h, type, subType, text) {
        var obj = {
            id: id,
            type: type,
            subType: subType,
            selected: false,
            color: "#636363",
            background_color: subType == "text" ? "white" : default_color,
            name: id,
            x: x,
            y: y,
            width: w,
            height: h,
            text: text
        };
        return obj;
    }
    function make_line(id, x, y, w, h, inter) {
        var obj = {
            id: id,
            type: "line",
            x: x,
            y: y,
            path: [ {
                x: w,
                y: -h,
                linked_to: null,
                id: id + "_0",
                interpolate: inter
            }, {
                x: w / 2,
                y: -(h / 2),
                id: id + "_1",
                interpolate: inter
            }, {
                x: 0,
                y: 0,
                id: id + "_2",
                interpolate: inter
            }, {
                x: -(w / 2),
                y: h / 2,
                id: id + "_3",
                interpolate: inter
            }, {
                x: -w,
                y: h,
                linked_to: null,
                id: id + "_4",
                interpolate: inter
            } ],
            color: default_color,
            start_shape: default_link_end,
            end_shape: default_link_end,
            name: id
        };
        return obj;
    }
    link_points = {};
    link_points.table = [ {
        name: "left-top",
        crow_rotate: 180,
        position: function(w, h) {
            return {
                x: -(w / 2),
                y: -(h / 3.5)
            };
        },
        offset: function(x, y) {
            return {
                x: x - link_offset,
                y: y
            };
        }
    }, {
        name: "left-bottom",
        crow_rotate: 180,
        position: function(w, h) {
            return {
                x: -(w / 2),
                y: h / 3.5
            };
        },
        offset: function(x, y) {
            return {
                x: x - link_offset,
                y: y
            };
        }
    }, {
        name: "right-bottom",
        crow_rotate: 0,
        position: function(w, h) {
            return {
                x: w / 2,
                y: h / 3.5
            };
        },
        offset: function(x, y) {
            return {
                x: x + link_offset,
                y: y
            };
        }
    }, {
        name: "right-top",
        crow_rotate: 0,
        position: function(w, h) {
            return {
                x: w / 2,
                y: -(h / 3.5)
            };
        },
        offset: function(x, y) {
            return {
                x: x + link_offset,
                y: y
            };
        }
    }, {
        name: "top",
        crow_rotate: 270,
        position: function(w, h) {
            return {
                x: 0,
                y: -(h / 2)
            };
        },
        offset: function(x, y) {
            return {
                x: x,
                y: y - link_offset
            };
        }
    }, {
        name: "bottom",
        crow_rotate: 90,
        position: function(w, h) {
            return {
                x: 0,
                y: h / 2
            };
        },
        offset: function(x, y) {
            return {
                x: x,
                y: y + link_offset
            };
        }
    } ];
    link_points.shape = [ {
        name: "left",
        crow_rotate: 180,
        position: function(w, h) {
            return {
                x: -(w / 2),
                y: 0
            };
        },
        offset: function(x, y) {
            return {
                x: x - link_offset,
                y: y
            };
        }
    }, {
        name: "right",
        crow_rotate: 0,
        position: function(w, h) {
            return {
                x: w / 2,
                y: 0
            };
        },
        offset: function(x, y) {
            return {
                x: x + link_offset,
                y: y
            };
        }
    }, {
        name: "top",
        crow_rotate: 270,
        position: function(w, h) {
            return {
                x: 0,
                y: -(h / 2)
            };
        },
        offset: function(x, y) {
            return {
                x: x,
                y: y - link_offset
            };
        }
    }, {
        name: "bottom",
        crow_rotate: 90,
        position: function(w, h) {
            return {
                x: 0,
                y: h / 2
            };
        },
        offset: function(x, y) {
            return {
                x: x,
                y: y + link_offset
            };
        }
    } ];
    var lineFunction = d3.svg.line().x(function(d) {
        return d.x;
    }).y(function(d) {
        return d.y;
    }).interpolate("linear");
    var freeLineFunction = d3.svg.line().x(function(d, i) {
        var _id = d.id.split("_")[0] + "_" + d.id.split("_")[1];
        if ((i == 0 || i == 4) && d.linked_to !== null) return line_linker(d.linked_to, d3.transform(d3.select("#" + _id).attr("transform")).translate).x; else {
            return d.x;
        }
    }).y(function(d, i) {
        var _id = d.id.split("_")[0] + "_" + d.id.split("_")[1];
        if ((i == 0 || i == 4) && d.linked_to !== null) return line_linker(d.linked_to, d3.transform(d3.select("#" + _id).attr("transform")).translate).y; else {
            return d.y;
        }
    }).interpolate("cardinal");
    /********* Make the grid *************/
    for (var g_y = t_height / 1.5; g_y < h - t_height / 1.5; g_y += t_height + margin) {
        for (var g_x = t_width / 1.5; g_x < w - t_width / 1.5; g_x += t_width + margin) {
            var obj = {
                x: g_x,
                y: g_y,
                occupant: false
            };
            grid.push(obj);
        }
    }
    /********** chat function ***********/
    $("#chat_input_text").keypress(function(e) {
        if (e.which == 13) {
            $("#chat_input_text").val("");
        }
    });
    $("#chat_input_label").text("You are all alone.");
    /*********** add object function ****************/
    function addObject(type, t_h, t_w, subType) {
        count = data_obj.table.length + data_obj.shape.length + data_obj.line.length + 1;
        if (!data_obj.totals) data_obj.totals = {
            table: 0,
            shape: 0,
            line: 0
        };
        if (!data_obj.totals[type]) data_obj.totals[type] = count;
        if (!data_obj[type]) data_obj[type] = [];
        data_obj[type].sort();
        var id = data_obj.totals[type];
        //(data_obj[type].length>0) ? Number(data_obj[type][data_obj[type].length-1].id.replace(capitalize(type)+"_", ""))+1:1;
        data_obj.totals[type]++;
        if (draggingTool) {
            x = dragToolPosition[0] - $("#erd").offset().left;
            y = dragToolPosition[1] - $("#erd").offset().top;
            draggingTool = false;
        } else {
            if(grid[count]){
                x = grid[count].x;
                y = grid[count].y;
            }else{
                x = (w/2)-(t_width/2);
                y = (h/2)-(t_height/2)
            }
        }
        if (x > 0 && x < w && y > 0 && y < h) {
            if (type == "table") var obj = make_table("Table_" + id, "Entity" + id, x, y, t_width, t_height); else if (type == "line") var obj = make_line("Line_" + id, x, y, t_w, t_h, "cardinal"); else if (type == "shape") if (subType == "text") var obj = make_shape("Shape_" + id, x, y, t_w, t_h, "shape", subType, "Text"); else var obj = make_shape("Shape_" + id, x, y, t_h, t_w, "shape", subType);
            if (obj) {
                data_obj[type].push(obj);
                update();
            }
        } else {
            console.log("dragged out of bounds");
        }
    }
    //var addObjectData = {addTable:function(){addObject("table", t_height, t_width)}};
    d3.selectAll(".toolObject").on("click", function() {
        callAddObject(this.id);
    }).on("dragstart", function() {
        draggingTool = true;
    }).on("dragend", function() {
        dragToolPosition = [ d3.event.clientX, d3.event.clientY ];
        callAddObject(this.id);
    });
    function callAddObject(id) {
        switch (id) {
          case "addTable":
            addObject("table", t_height, t_width);
            break;

          case "addCircle":
            addObject("shape", t_height / 3, t_width / 3, "circle");
            break;

          case "addRectangle":
            addObject("shape", t_height / 3, t_width / 2.5, "rectangle");
            break;

          case "addDiamond":
            addObject("shape", t_height / 3, t_height / 3, "diamond");
            break;

          case "addTextBox":
            addObject("shape", 20, 40, "text");
            break;

          case "addLine":
            addObject("line", t_width / 3, t_height / 3);
            break;
        }
    }
    d3.selectAll("#reset").on("click", function() {
        $("#modal").modal("open");
        $("#modal_head").text("Clear the diagram");
        $("#modal_submit").text("Yes");
        $("#modal_content").html(function() {
            var html = "<p>This will remove everything from your diagram. Are you sure you want to do this?</p>";
            return html;
        });
        d3.select("#modal_submit").on("click", function() {
            data_obj = {
                table: [],
                shape: [],
                line: [],
                link: [],
                link_list: {}
            };
            update();
        });
    });
    /******************/
    d3.selectAll("#login").on("click", function() {
        login();
    });
    /******************/
    d3.selectAll("#delete").on("click", function() {
        createAccount();
    });
    /******************/
    d3.selectAll("#deleteSelection").on("click", function() {
        d3.selectAll(".selected").attr("class", function(d) {
            remove_object(d);
            update();
            return 0;
        });
        d3.selectAll(".selected").remove();
        selected = [];
    });
    /******************/
    d3.select("#selectAll").on("click", function() {
        d3.selectAll(".table").classed("selected", function(d) {
            selected.push(d.id);
            return true;
        });
        d3.selectAll(".shape").classed("selected", function(d) {
            selected.push(d.id);
            return true;
        });
        d3.selectAll(".shape").select(".main").style("stroke", "#2b8cbe").style("stroke-width", 5);
        d3.selectAll(".table").select(".table_border").style("stroke", "#2b8cbe").style("stroke-width", 5);
        console.log("select all");
        console.log(selected);
    });
    /******************/
    d3.select("#selectNone").on("click", function() {
        d3.selectAll(".shape").select(".main").style("stroke", "#636363").style("stroke-width", 2);
        d3.selectAll(".table").select(".table_border").style("stroke", "#636363").style("stroke-width", 2);
        d3.selectAll(".selected").classed("selected", function(d) {
            return false;
        });
        selected = [];
    });
    /******************/
    d3.selectAll("unavailable").on("click", function() {
        createAccount();
    });
    /******************/
    d3.select("#erd_name").on("click", function() {
        createAccount();
    });
    /*********************/
    d3.select("#createAccount").on("click", function() {
        createAccount();
    });
    /*********************/
    function createAccount() {
        modal_issue_fix = true;
        $("#modal").width("700px").height("auto");
        $("#modal").modal("open");
        $("#modal_head").text("Create Account");
        $("#modal_submit").text("Sign Up");
        //  $('#modal_cancel').off("click");
        //  $('body').off("click", "#modal_cancel");// .off( "click", "#theone"
        $("#modal_cancel").text("Cancel");
        $("#modal_cancel").on("click", function() {
            console.log("closing modal");
            $("#modal").modal("close");
        });
        $("#modal_content").html(function() {
            var html = "<p>Create an account to use all the features of this app.</p><p>Passwords are securely stored and your email will never be used for any purpose other than logging in.</p>";
            html += '<form style="height:170px;" id="signupForm" action="/signup" method="post"><div class="input-field col s6" style="margin-top:0;height:auto;"><input name="email" id="email" type="text" class="validate">';
            html += '<label class="active" for="email">Email:</label></div>';
            html += '<div class="input-field col s6" style="margin:0;height:auto;"><input name="password1" id="password1" type="password" class="validate">';
            html += '<label class="active" for="password1">Password:</label></div>';
            html += '<div class="input-field col s6" style="margin:0; height:auto;"><input name="password2" id="password2" type="password" class="validate">';
            html += '<label class="active" for="password2">Confirm Password:</label></div><input name="erd_to_server" id="erd_to_server" type="text" style="visibility:hidden;height:0px;"></form>';
            html += '<p id="signup_feedback" style="color:red;">' + signup_error + "</p>";
            return html;
        });
        d3.select("#erd_to_server").property("value", function() {
            return JSON.stringify(data_obj);
        });
        d3.select("#modal_submit").on("click", function() {
            if (d3.select("#password1").property("value") == d3.select("#password2").property("value")) {
                document.getElementById("signupForm").submit();
            } else {
                setTimeout(function() {
                    signup_error = "The passwords did not match, please try again.";
                    console.log("passwords didnt match");
                    createAccount();
                }, 500);
            }
        });
    }
    if(document.getElementById("colorPalette"))wheel();
    function wheel() {
        d3.select("#colorPalette").html("");
        // Add the color palette
        var o_width = +d3.select("#colorPalette").style("width").replace("px", ""), c_width = o_width / 100 * 80, c_height = c_width, radius = c_width / 2;
        var arc = d3.svg.arc().outerRadius(radius / 1.5).innerRadius(radius / 2);
        var pie = d3.layout.pie().sort(null).value(function(d) {
            return 1;
        });
        var wheel_svg = d3.select("#colorPalette").append("svg").attr("width", c_width).attr("height", c_height).append("g").attr("transform", "translate(" + o_width / 2 + "," + c_height / 2 + ")");
        var g = wheel_svg.selectAll(".arc").data(pie(color_palette_list)).enter().append("g").attr("class", function(d) {
            return "arc";
        });
        g.append("path").attr("d", arc).style("stroke", function(d) {
            return d;
        }).style("fill", function(d) {
            return d.data;
        }).style("cursor", "pointer").on("mouseover", function(d) {
            d3.select("#selected_color").style("fill", d.data);
        }).on("mouseout", function(d) {
            d3.select("#selected_color").style("fill", default_color);
        }).on("click", function(d) {
            default_color = d.data;
            d3.select("#selected_color").style("fill", default_color);
            d3.selectAll(".selected.table").select(".table_name_background").style("fill", default_color);
            d3.selectAll(".selected.table").select(".table_name").style("fill", default_color);
            d3.selectAll(".selected.shape").select(".main").style("fill", default_color);
            for (var i = 0; i < selected.length; i++) {
                var selected_type = selected[i].split("_")[0].toLowerCase();
                for (s in data_obj[selected_type]) {
                    if (data_obj[selected_type][s].id == selected[i]) {
                        if (selected_type == "table") data_obj[selected_type][s].color = default_color; else data_obj[selected_type][s].background_color = default_color;
                        console.log(data_obj[selected_type][s]);
                    }
                }
            }
        });
        wheel_svg.append("circle").attr("id", "selected_color").attr("r", radius / 4).attr("x", c_width / 2).attr("y", c_width / 2).style("fill", "blue");
        /********* add crows feet buttons ***/
        d3.select("#linkEnds").html("").selectAll(".linkEndTool").data(crow_symbols).enter().append("div").attr("class", "linkEndTool").attr("id", function(d) {
            return "linkEnd_" + d;
        }).on("mouseover", function() {
            d3.selectAll(".linkEndTool").style("opacity", ".6");
            d3.select(this).style("opacity", "1");
        }).on("mouseout", function() {
            d3.selectAll(".linkEndTool").style("opacity", ".6");
            d3.select("#linkEnd_" + default_link_end).style("opacity", "1");
        }).on("click", function(d) {
            d3.selectAll(".linkEndTool").style("opacity", ".6");
            d3.select(this).style("opacity", "1");
            default_link_end = d;
        }).append("img").attr("src", function(d) {
            return "images/crow/" + d + ".svg";
        });
    }
    //setup svg canvas
    var canvas = d3.select("#erd").append("svg:svg").attr("width", w).attr("height", h).attr("id", "erd_svg");
    canvas_background = canvas.append("rect").attr("x", 0).attr("y", 0).attr("width", "100%").attr("height", "100%").style("fill", "white").on("click", function() {
        selected = [];
        d3.selectAll(".selected").select(".table_border").style("stroke", "#636363").style("stroke-width", 2);
        d3.selectAll(".selected").select(".shape_border").style("stroke", "#636363").style("stroke-width", 2);
        d3.selectAll(".selected").classed("selected", false);
    });
    temp_line = canvas.append("line").attr("class", "temp_line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 0);
    temp_path = canvas.append("path").attr("d", lineFunction(pathData)).attr("class", "temp_path");
    defs = canvas.append("defs");
    for (c in crow_svgs) {
        defs.append("marker").attr({
            id: "crow_" + crow_svgs[c].id,
            viewBox: "0 0 100 100",
            refX: 30,
            refY: 8,
            markerWidth: 50,
            markerHeight: 50,
            orient: "auto-start-reverse"
        }).node().appendChild(crow_svgs[c].svg);
    }
    var symbol_chooser = canvas.append("g").attr("class", "symbol_chooser").style("visibility", "hidden").attr("transform", "translate(100,100)");
    symbol_chooser.append("rect").attr("class", "symbol_chooser").style("fill", "white").style("stroke", "black").attr("pointer-events", "all").attr("width", 90).attr("height", 90).attr("rx", 5).attr("ry", 5);
    symbol_chooser.append("g").append("svg:image").attr("xlink:href", "images/close.svg").attr("width", 15).attr("height", 15).attr("y", 0).attr("x", 75).style("cursor", "pointer").on("mousedown", function() {
        symbol_chooser.attr("transform", "translate(-100,-100)").style("visibility", "hidden");
    });
    /***********************************************************************************************************************************/
    symbol_chooser.append("g").selectAll(".symbol_chooser").data(crow_symbols).enter().append("svg:image").attr("class", "symbol").style("cursor", "pointer").attr("xlink:href", function(d) {
        return "images/crow/" + d + ".svg";
    }).attr("width", 20).attr("height", 20).attr("y", function(d, i) {
        var y_shift = 0;
        if (i > 2) y_shift = 25;
        if (i > 5) y_shift = 50;
        if (i > 8) y_shift = 75;
        return 10 + y_shift;
    }).attr("x", function(d, i) {
        var nextLine = i > 2 ? -(3 * 25) : 0;
        var x_shift = i * 25;
        //-(Math.round((i+1)/3) * (3*25));
        if (i > 2) x_shift = (i - 3) * 25;
        if (i > 5) x_shift = (i - 6) * 25;
        if (i > 8) x_shift = (i - 9) * 25;
        return 10 + x_shift;
    }).on("mousedown", function() {
        console.log("Down");
    });
    function build_link_path(thisPath, d, start_offset, target_offset, origin_x, origin_y) {
        if (!target_offset) target_offset = function(x, y) {
            return {
                x: x,
                y: y
            };
        };
        //else d = {x:d3.select("#"+target).attr("cx"), y:d3.select("#"+target).attr("cy")}// need real positions for snap to
        thisPath[0].x = origin_x;
        thisPath[0].y = origin_y;
        thisPath[1].x = start_offset(origin_x, origin_y).x;
        thisPath[1].y = start_offset(origin_x, origin_y).y;
        thisPath[2].x = start_offset(origin_x, origin_y).x;
        thisPath[2].y = target_offset(d.x, d.y).y;
        //d.y;
        thisPath[3].x = target_offset(d.x, d.y).x;
        //d.x;
        thisPath[3].y = target_offset(d.x, d.y).y;
        //d.y;
        thisPath[4].x = d.x;
        thisPath[4].y = d.y;
        return thisPath;
    }
    var linkTables = d3.behavior.drag().on("drag", function(d, i) {
        if (!d.type) d.type = "table";
        // show the link points //
        d3.selectAll(".link_point").style("visibility", "visible");
        var thisLink = d3.select(this);
        start_position = thisLink.attr("class").replace("link_point ", "");
        console.log("target = " + target);
        if (target_aquired) target_position = d3.select("#" + target).attr("class").replace("link_point ", ""); else target_position = null;
        for (var l in link_points) {
            link_points[l].forEach(function(point) {
                if (point.name == start_position) {
                    start_position = point.offset;
                    start_rotation = point.crow_rotate;
                }
                if (target_position) {
                    if (point.name == target_position) {
                        // This shit is mad, what were you thinking?::: Yeah but there must have been some logic behind it?
                        target_position = point.offset;
                        target_rotation = point.crow_rotate;
                    }
                }
            });
        }
        if (dragging) {
            d.x += d3.event.dx;
            d.y += d3.event.dy;
        } else {
            link_from = thisLink.attr("id");
            origin_x = d3.transform(d3.select(this.parentNode).attr("transform")).translate[0] + Number(d3.select(this).attr("cx"));
            //d3.mouse(canvas.node())[0];
            origin_y = d3.transform(d3.select(this.parentNode).attr("transform")).translate[1] + Number(d3.select(this).attr("cy"));
            //d3.mouse(canvas.node())[1];
            d.x = origin_x;
            d.y = origin_y;
        }
        dragging = true;
        //build_link_path(thisPath, d, start_offset, target_offset, origin_x, origin_y)
        if (target_position !== null) {
            // To snap to target link
            var target_parent = target.split("_");
            target_parent = target_parent[0] + "_" + target_parent[1];
            //console.log(d3.transform(d3.select("#"+target_parent).attr("transform")).translate)
            //console.log("x: "+d3.select("#"+target).attr("cx")+" y: "+d3.select("#"+target).attr("cy"))
            d.x = d3.transform(d3.select("#" + target_parent).attr("transform")).translate[0] + Number(d3.select("#" + target).attr("cx"));
            d.y = d3.transform(d3.select("#" + target_parent).attr("transform")).translate[1] + Number(d3.select("#" + target).attr("cy"));
        }
        pathData = build_link_path(pathData, d, start_position, target_position, origin_x, origin_y);
        temp_path.style("visibility", "visible").attr("d", lineFunction(pathData));
    }).on("dragend", function(d, i) {
        temp_path.style("visibility", "hidden");
        if (!d.type) d.type = "table";
        dragging = false;
        if (target_aquired) {
            if (!target_position) target_position = function(x, y) {
                return {
                    x: x,
                    y: y
                };
            };
            if (!d3.select("#" + link_from + "-" + target)[0][0]) {
                var this_path = clone(pathData);
                for (var sp in link_points[d.type]) {
                    // Looking for the offset function which corresponds to the position on the table
                    if (link_points[d.type][sp].name == link_from) {
                        start_position = link_points[d.type][sp].offset;
                        start_rotation = link_points[d.type][sp].crow_rotate;
                    }
                    if (target_position) {
                        if (link_points[d.type][sp].name == target) {
                            target_position = link_points[d.type][sp].offset;
                            target_rotation = link_points[d.type][sp].crow_rotate;
                        }
                    }
                }
                //console.log(this_path)
                data_obj.link.push({
                    id: link_from + "-" + target,
                    path: this_path,
                    relationship: "relationship",
                    crow: {
                        rotate: {
                            start: start_rotation,
                            end: target_rotation
                        },
                        type: {
                            start: default_link_end,
                            end: default_link_end
                        }
                    }
                });
                var link_id = link_from.split("_")[0] + "_" + link_from.split("_")[1];
                if (!data_obj.link_list[link_id]) data_obj.link_list[link_id] = [];
                var obj = {};
                obj.to = target;
                obj.from = link_from;
                obj.direction = "outward";
                //this deals with the x1 and y1 coords of the line
                obj.path = this_path;
                data_obj.link_list[link_id].push(obj);
                // set up the reverse link //
                var link_id = target.split("_")[0] + "_" + target.split("_")[1];
                if (!data_obj.link_list[link_id]) data_obj.link_list[link_id] = [];
                var obj2 = {};
                obj2.to = target;
                obj2.from = link_from;
                obj2.direction = "inward";
                //this deals with the x2 and y2 coords of the line
                obj2.path = this_path;
                data_obj.link_list[link_id].push(obj2);
                update();
            }
            d3.selectAll(".link").style("visibility", "hidden");
            d3.selectAll(".link_point").style("visibility", "hidden");
        }
    });
    var drag = d3.behavior.drag().on("dragstart", function(d) {
        // To fix jumpy behaviour when first dragging
        drag_offset_x = d3.mouse(d3.select(this).node())[0];
        drag_offset_y = d3.mouse(d3.select(this).node())[1];
    }).on("drag", function(d) {
        drag_x = d3.mouse(canvas.node())[0] - drag_offset_x;
        drag_y = d3.mouse(canvas.node())[1] - drag_offset_y;
        var start = d.id;
        //d3.select(this.parentNode).attr("id");
        if (!d.type) d.type = "table";
        if (d.type == "shape") {
            var this_table = data_obj.shape.filter(function(obj) {
                return obj.id == start;
            });
        } else {
            var this_table = data_obj.table.filter(function(obj) {
                return obj.id == start;
            });
        }
        if (this_table[0]) {
            // update the array with the new coords //
            this_table[0].x = drag_x;
            this_table[0].y = drag_y;
            if (data_obj.link_list[start]) {
                //  console.log(data_obj.link_list[start])
                for (var l in data_obj.link_list[start]) {
                    //  this_path = data_obj.link_list[start][l].path;
                    for (var i in data_obj.link) {
                        if (data_obj.link_list[start][l]) {
                            if (data_obj.link[i].id == data_obj.link_list[start][l].from + "-" + data_obj.link_list[start][l].to) {
                                var this_path = data_obj.link[i].path;
                            }
                        }
                    }
                    var from_offset = {
                        x: drag_x + Number(d3.select("#" + data_obj.link_list[start][l].from).attr("cx")),
                        y: drag_y + Number(d3.select("#" + data_obj.link_list[start][l].from).attr("cy"))
                    };
                    var to_offset = {
                        x: drag_x + Number(d3.select("#" + data_obj.link_list[start][l].to).attr("cx")),
                        y: drag_y + Number(d3.select("#" + data_obj.link_list[start][l].to).attr("cy"))
                    };
                    /********* setup offset functions ******/
                    start_offset = d3.select("#" + data_obj.link_list[start][l].from).attr("class").replace("link_point ", "");
                    target_offset = d3.select("#" + data_obj.link_list[start][l].to).attr("class").replace("link_point ", "");
                    //  console.log("start : "+start_offset+",  target : "+target_offset)
                    for (var sp in link_points[d.type]) {
                        // Looking for the offset function which corresponds to the position on the table
                        if (link_points[d.type][sp].name == start_offset) start_offset = link_points[d.type][sp].offset;
                        // converting a string to a function !!!!
                        if (link_points[d.type][sp].name == target_offset) target_offset = link_points[d.type][sp].offset;
                    }
                    //*************************************************************** Needs refactoring *******************************/
                    if (data_obj.link_list[start][l].direction == "outward") {
                        this_path[0].x = from_offset.x;
                        this_path[0].y = from_offset.y;
                        this_path[1].x = start_offset(from_offset.x, from_offset.y).x;
                        this_path[1].y = start_offset(from_offset.x, from_offset.y).y;
                    } else if (data_obj.link_list[start][l].direction == "inward") {
                        this_path[4].x = to_offset.x;
                        this_path[4].y = to_offset.y;
                        this_path[3].x = target_offset(to_offset.x, to_offset.y).x;
                        this_path[3].y = target_offset(to_offset.x, to_offset.y).y;
                    }
                    //this_path[2].x =  (this_path[1].x+this_path[3].x)/2;
                    //this_path[2].y =  (this_path[1].y+this_path[3].y)/2;
                    data_obj.link_list[start][l].path = this_path;
                    for (var i in data_obj.link) {
                        if (data_obj.link[i].id == data_obj.link_list[start][l].from + "-" + data_obj.link_list[start][l].to) {
                            data_obj.link[i].path = this_path;
                        }
                    }
                }
            } else {}
            update();
        } else {
            console.log("table not found!");
        }
    }).on("dragend", function() {
        console.log("drag end");
    });
    var drag_middle = d3.behavior.drag().on("drag", function(d, i) {
        d.path[2].x = d3.mouse(canvas.node())[0];
        d.path[2].y = d3.mouse(canvas.node())[1];
        update();
    });
    var drag_line = d3.behavior.drag().on("dragstart", function(d) {
        drag_offset_x = d3.mouse(d3.select(this).node())[0];
        drag_offset_y = d3.mouse(d3.select(this).node())[1];
        console.log(d3.mouse(d3.select(this).node()));
    }).on("drag", function(d, i) {
        d.x = d3.mouse(canvas.node())[0] - drag_offset_x;
        d.y = d3.mouse(canvas.node())[1] - drag_offset_y;
        update();
    });
    var line_reshape = d3.behavior.drag().on("dragstart", function(d) {
        line_reshaping = true;
        dragging = true;
    }).on("drag", function(d, i) {
        d.linked_to = null;
        var parent_pos = d3.transform(d3.select(this.parentNode).attr("transform")).translate;
        d.x = d3.mouse(canvas.node())[0] - parent_pos[0];
        d.y = d3.mouse(canvas.node())[1] - parent_pos[1];
        if ((i == 0 || i == 4) && target_aquired) {
            d.linked_to = target;
            d.x = line_linker(target, parent_pos).x;
            d.y = line_linker(target, parent_pos).y;
        }
        update();
    }).on("dragend", function(d) {
        line_reshaping = false;
        dragging = false;
        update();
    });
    function line_linker(t, p_pos) {
        var obj = {};
        var target_parent_pos = d3.transform(d3.select("#" + t.split("_")[0] + "_" + t.split("_")[1]).attr("transform")).translate;
        obj.x = target_parent_pos[0] - p_pos[0] + d3.select("#" + t).node().getBBox().x;
        obj.y = target_parent_pos[1] - p_pos[1] + d3.select("#" + t).node().getBBox().y;
        return obj;
    }
    var resize_x = d3.behavior.drag().on("drag", function(d, i) {
        var e = d3.event;
        var x = e.dx > 0 ? 2 : -2;
        if (d.type == "table") {
            d.width = Math.max(90, d.width + x);
        } else if (d.type == "shape") {
            d.width = Math.max(10, d.width + x);
            if (d.subType == "diamond") {
                d.height = Math.max(10, d.height + x);
            }
        }
        canvas.selectAll("g." + d.type).remove();
        update();
    });
    var resize_y = d3.behavior.drag().on("drag", function(d, i) {
        var e = d3.event;
        var y = e.dy > 0 ? 2 : -2;
        if (d.type == "table") {
            d.height = Math.max(90, d.height + y);
        } else if (d.type == "shape") {
            d.height = Math.max(10, d.height + y);
            if (d.subType == "diamond") {
                d.width = Math.max(10, d.width + y);
            }
        }
        canvas.selectAll("g." + d.type).remove();
        update();
    });
    function line_to_link(d) {
        var from = d.path[0].linked_to.split("_");
        from = from[0] + "_" + from[1];
        var to = d.path[4].linked_to.split("_");
        to = to[0] + "_" + to[1];
        var obj = {
            id: d.path[0].linked_to + "-" + d.path[4].linked_to,
            relationship: "relationship",
            path: [],
            crow: {
                rotate: {
                    start: 0,
                    end: 0
                },
                type: {
                    start: d.start_shape,
                    end: d.end_shape
                }
            }
        };
        var crow_stuff_start = $.grep(link_points[d.path[0].linked_to.split("_")[0].toLowerCase()], function(v) {
            return v.name === d.path[0].linked_to.split("_")[2];
        })[0];
        var crow_stuff_end = $.grep(link_points[d.path[4].linked_to.split("_")[0].toLowerCase()], function(v) {
            return v.name === d.path[4].linked_to.split("_")[2];
        })[0];
        obj.crow.rotate.start = crow_stuff_start.crow_rotate;
        obj.crow.rotate.end = crow_stuff_end.crow_rotate;
        for (var i = 0; i < d.path.length; i++) {
            obj.path.push({
                x: d.x + d.path[i].x,
                y: d.y + d.path[i].y
            });
        }
        //d3.transform(d3.select(this.parentNode).attr("transform")).translate;
        var to_pos = {
            x: Number(d3.transform(d3.select("#" + to).attr("transform")).translate[0]),
            y: Number(d3.transform(d3.select("#" + to).attr("transform")).translate[1])
        };
        to_pos.x += Number(d3.select("#" + d.path[4].linked_to).attr("cx"));
        to_pos.y += Number(d3.select("#" + d.path[4].linked_to).attr("cy"));
        var from_pos = {
            x: Number(d3.transform(d3.select("#" + from).attr("transform")).translate[0]),
            y: Number(d3.transform(d3.select("#" + from).attr("transform")).translate[1])
        };
        from_pos.x += Number(d3.select("#" + d.path[0].linked_to).attr("cx"));
        from_pos.y += Number(d3.select("#" + d.path[0].linked_to).attr("cy"));
        obj.path[0] = {
            x: from_pos.x,
            y: from_pos.y
        };
        obj.path[4] = {
            x: to_pos.x,
            y: to_pos.y
        };
        obj.path[1] = {
            x: crow_stuff_start.offset(obj.path[0].x, obj.path[0].y).x,
            y: crow_stuff_start.offset(obj.path[0].x, obj.path[0].y).y
        };
        obj.path[3] = {
            x: crow_stuff_end.offset(obj.path[4].x, obj.path[4].y).x,
            y: crow_stuff_end.offset(obj.path[4].x, obj.path[4].y).y
        };
        data_obj.link.push(obj);
        // Set up linklist for link lookups
        if (!data_obj.link_list[from]) data_obj.link_list[from] = [];
        data_obj.link_list[from].push({
            to: d.path[4].linked_to,
            from: d.path[0].linked_to,
            direction: "outward",
            path: obj.path
        });
        // set up the reverse link //
        if (!data_obj.link_list[to]) data_obj.link_list[to] = [];
        data_obj.link_list[to].push({
            to: d.path[4].linked_to,
            from: d.path[0].linked_to,
            direction: "inward",
            path: obj.path
        });
    }
    function update() {
        //  var output = "";
        //for(var s = 0; s<data_obj.shape.length; s++){if(data_obj.shape[s].subType=="text"){console.log(data_obj.shape[s])};output+=data_obj.shape[s].id+" : "+data_obj.shape[s].subType+",  "};
        //console.log(output);
        canvas.selectAll("g.link").remove();
        // had to remove all links and redraw them
        canvas.selectAll("g.line").remove();
        //canvas.selectAll("g.textbox").remove();
        var link = canvas.selectAll("g.link").data(data_obj.link);
        var linkEnter = link.enter().append("g").attr("class", "link");
        linkEnter.append("path").attr("d", function(d) {
            return lineFunction(d.path);
        }).attr("id", function(d) {
            return d.id;
        }).style("stroke-width", 10).style("stroke-opacity", 0).style("fill", "none").attr("class", "link_line");
        linkEnter.append("path").attr("d", function(d) {
            return lineFunction(d.path);
        }).attr("id", function(d) {
            return d.id;
        }).attr("class", "link_line").attr("marker-start", function(d) {
            if (!msieversion()) return "url(#crow_" + d.crow.type.start + ")"; else return null;
        }).attr("marker-end", function(d) {
            if (!msieversion()) return "url(#crow_" + d.crow.type.end + ")"; else return null;
        }).style("fill", "none").style("stroke", "black").style("stroke-width", 2).style("visibility", "visible");
        link.on("mouseover", function(d) {
            d3.select(this).selectAll(".middle").style("visibility", "visible");
            d3.select(this).selectAll(".remove_link").style("visibility", "visible");
        }).on("mouseout", function(d) {
            d3.select(this).selectAll(".middle").style("visibility", "hidden");
            d3.select(this).selectAll(".remove_link").style("visibility", "hidden");
        });
        var relationship = linkEnter.append("g").attr("transform", function(d) {
            return "translate(" + (d.path[2].x - d.relationship.length * 2 - 4) + "," + (d.path[2].y + 5) + ")";
        });
        relationship.append("rect").attr("class", "relationship").style("visibility", "visible").style("stroke", function(d) {
            if (d.relationship.length > 0) return "black"; else return "none";
        }).style("fill", function(d) {
            if (d.relationship.length > 0) return "white"; else return "none";
        }).attr("rx", 2).attr("ry", 2);
        relationship.append("text").attr("class", "relationship unselectable").style("visibility", "visible").style("font-family", "Helvetica").style("text-anchor", "start").attr("x", 2).attr("dy", "1em").text(function(d) {
            return d.relationship;
        }).call(make_editable, "relationship");
        relationship.selectAll("rect").attr("width", function(d) {
            return this.parentNode.getBBox().width + 6;
        }).attr("height", function(d) {
            return this.parentNode.getBBox().height + 2;
        });
        d3.selectAll(".relationship").selectAll("rect").attr("width", function(d) {
            return this.parentNode.getBBox().width + 6;
        }).attr("height", function(d) {
            return this.parentNode.getBBox().height + 2;
        });
        linkEnter.append("svg:image").attr("class", "remove_link").style("visibility", "hidden").style("cursor", "pointer").attr("xlink:href", "images/close.svg").attr("width", 20).attr("height", 20).attr("x", function(d) {
            return d.path[2].x - 10;
        }).attr("y", function(d) {
            return d.path[2].y - 27;
        }).on("click", function(d) {
            data_obj.link = data_obj.link.filter(function(obj) {
                return obj.id != d.id;
            });
            var to_delete = [];
            console.log(data_obj.link_list);
            for (o in data_obj.link_list) {
                for (l in data_obj.link_list[o]) {
                    console.log("L " + l);
                    console.log(data_obj.link_list[o]);
                    console.log(data_obj.link_list[o][l].from + data_obj.link_list[o][l].to + "  =  " + d.id);
                    if (data_obj.link_list[o][l].from + "-" + data_obj.link_list[o][l].to == d.id) to_delete.push({
                        o: o,
                        l: l
                    });
                }
            }
            for (del in to_delete) {
                delete data_obj.link_list[to_delete[del].o][to_delete[del].l];
            }
            d3.selectAll("#" + d.id).remove();
            update();
        });
        linkEnter.append("circle").attr("class", "middle").style("visibility", "hidden").style("fill", "grey").style("cursor", "move").attr("r", 8).attr("cx", function(d) {
            return d.path[2].x;
        }).attr("cy", function(d) {
            return d.path[2].y;
        }).call(drag_middle).on("click", function(d) {
            console.log("CLICK");
        });
        if (ie) {
            // IE doesn't fully support marker ends so this is a work around
            link.append("g").append("svg:image").attr("xlink:href", function(d) {
                return "images/crow/" + d.crow.type.start + ".svg";
            }).attr("width", 30).attr("height", 20).attr("x", -30).attr("y", -10).attr("transform", function(d) {
                return "translate(" + d.path[0].x + "," + d.path[0].y + ") rotate(" + (180 + d.crow.rotate.start) + ")";
            }).style("cursor", "pointer").style("visibility", "visible");
            link.append("g").append("svg:image").attr("xlink:href", function(d) {
                return "images/crow/" + d.crow.type.end + ".svg";
            }).attr("width", 30).attr("height", 20).attr("x", -30).attr("y", -10).attr("transform", function(d) {
                return "translate(" + d.path[4].x + "," + d.path[4].y + ") rotate(" + (180 + d.crow.rotate.end) + ")";
            }).style("cursor", "pointer").style("visibility", "visible");
        }
        link.append("g").append("rect").attr("class", "crow_foot start").attr("opacity", 0).attr("width", 40).attr("height", 30).attr("x", -20).attr("y", -15).attr("transform", function(d) {
            return "translate(" + d.path[0].x + "," + d.path[0].y + ") rotate(" + d.crow.rotate.start + ")";
        }).style("cursor", "pointer").style("visibility", "visible");
        link.append("g").append("rect").attr("class", "crow_foot end").attr("opacity", 0).attr("width", 40).attr("height", 30).attr("x", -20).attr("y", -15).attr("transform", function(d) {
            return "translate(" + d.path[4].x + "," + d.path[4].y + ") rotate(" + d.crow.rotate.end + ")";
        }).style("cursor", "pointer").style("visibility", "visible");
        d3.selectAll(".crow_foot").on("click", function(d) {
            var which_end = d3.select(this).attr("class").replace("crow_foot ", "");
            symbol_chooser.moveToFront();
            symbol_chooser.attr("transform", function(d) {
                return "translate(" + (d3.mouse(canvas.node())[0] - symbol_chooser.select("rect").attr("width") / 2) + "," + (d3.mouse(canvas.node())[1] - symbol_chooser.select("rect").attr("height") / 2) + ")";
            }).style("visibility", "visible");
            symbol_chooser.selectAll(".symbol").on("mousedown", function(d2) {
                d.crow.type[which_end] = d2;
                symbol_chooser.attr("transform", "translate(-100,-100)").style("visibility", "hidden");
                update();
            });
        });
        if (!data_obj.line) data_obj.line = [];
        // Temporary shim for old drawings without lines
        var line = canvas.selectAll("g.line").data(data_obj.line);
        var lineEnter = line.enter().append("g").attr("class", "line").attr("id", function(d) {
            return d.id;
        }).attr("transform", function(d, i) {
            if (d.path[0].linked_to !== null && d.path[4].linked_to !== null && line_reshaping == false) {
                convert_line_to_link = d;
            }
            return "translate(" + d.x + "," + d.y + ")";
        }).on("mouseover", function(d) {
            d3.select(this).select(".line_path_big").style("stroke-opacity", .5);
            d3.select(this).selectAll(".line_move").style("visibility", "visible");
        }).on("mouseout", function() {
            if (d3.select(this).attr("class") !== "line selected") {
                d3.select(this).select(".line_path_big").style("stroke-opacity", 0);
            }
            d3.select(this).selectAll(".line_move").style("visibility", "hidden");
        }).on("click", function(d) {
            d3.select(this).select(".line_path_big").style("stroke-opacity", .5);
            if (d3.event.shiftKey) {
                d3.select(this).classed("selected", true);
                selected.push(d3.select(this).attr("id"));
            } else {
                d3.selectAll(".table.selected").select(".table_border.main").style("stroke", "#636363").style("stroke-width", 2);
                d3.selectAll(".shape.selected").select(".shape_border").style("stroke", "#636363").style("stroke-width", 2);
                d3.selectAll(".line.selected").select(".line_path_big").style("stroke-opacity", 0);
                d3.selectAll(".selected").classed("selected", false);
                d3.select(this).classed("selected", true);
                selected = [ d3.select(this).attr("id") ];
            }
        });
        lineEnter.append("path").attr("d", function(d) {
            return freeLineFunction(d.path);
        }).attr("id", function(d) {
            return d.id;
        }).style("stroke-width", 15).style("stroke-opacity", 0).style("stroke", "blue").style("fill", "none").attr("class", "line_path_big").call(drag_line);
        lineEnter.append("path").attr("d", function(d) {
            return freeLineFunction(d.path);
        }).attr("id", function(d) {
            return d.id;
        }).attr("class", "line_path").attr("marker-start", function(d) {
            if (!msieversion()) return "url(#crow_" + d.start_shape + ")"; else return null;
        }).attr("marker-end", function(d) {
            if (!msieversion()) return "url(#crow_" + d.end_shape + ")"; else return null;
        }).style("fill", "none").style("stroke", "black").style("stroke-width", 2).style("visibility", "visible");
        var lineMove = lineEnter.selectAll(".line_move").data(function(d) {
            return d.path;
        }).enter().append("circle").attr("class", function(d) {
            return "line_move ";
        }).style("visibility", "hidden").style("opacity", .4).attr("id", function(d, i) {
            return this.parentNode.id + "_" + i;
        }).attr("r", 10).attr("cx", function(d, i) {
            if ((i == 0 || i == 4) && d.linked_to !== null) return line_linker(d.linked_to, d3.transform(d3.select("#" + this.parentNode.id).attr("transform")).translate).x; else return d.x;
        }).attr("cy", function(d, i) {
            if ((i == 0 || i == 4) && d.linked_to !== null) return line_linker(d.linked_to, d3.transform(d3.select("#" + this.parentNode.id).attr("transform")).translate).y; else return d.y;
        }).on("mouseover", function(d) {}).on("mouseout", function() {}).call(line_reshape);
        d3.selectAll(".line_end").on("click", function(d) {
            var which_end = d3.select(this).attr("class").replace("line_end ", "") + "_shape";
            symbol_chooser.moveToFront();
            symbol_chooser.attr("transform", function(d) {
                return "translate(" + (d3.mouse(canvas.node())[0] - symbol_chooser.select("rect").attr("width") / 2) + "," + (d3.mouse(canvas.node())[1] - symbol_chooser.select("rect").attr("height") / 2) + ")";
            }).style("visibility", "visible");
            symbol_chooser.selectAll(".symbol").on("mousedown", function(d2) {
                d[which_end] = d2;
                symbol_chooser.attr("transform", "translate(-100,-100)").style("visibility", "hidden");
                update();
            });
        });
        var shape = canvas.selectAll("g.shape").data(data_obj.shape);
        var shapeEnter = shape.enter().append("g").attr("class", function(d) {
            return "shape";
        }).attr("id", function(d) {
            return d.id;
        }).attr("transform", function(d, i) {
            return "translate(" + d.x + "," + d.y + ")";
        }).on("mouseover", function(d) {
            d3.select(this).select(".main").style("stroke", "#2b8cbe").style("stroke-width", 5);
            d3.select(this).selectAll(".link_point").style("visibility", "visible");
            //  d3.select(this).select(".remove_table").style("visibility", "visible");
            if (dragging && !target_aquired) {
                //console.log("d : "+d.x+" "+d.y);
                var dists = [];
                var mouse_pos = {
                    x: (d3.event.clientX - svg_offset.x).toFixed(2),
                    y: (d3.event.clientY - svg_offset.y).toFixed(2)
                };
                d3.select(this).selectAll(".link_point").attr("r", function(d2, i) {
                    var temp_x = Number(d2.position(d3.select(this.parentNode).select(".main").attr("width"), d3.select(this.parentNode).select(".main").attr("height")).x);
                    var temp_y = Number(d2.position(d3.select(this.parentNode).select(".main").attr("width"), d3.select(this.parentNode).select(".main").attr("height")).y);
                    var dist = distance(mouse_pos.x, mouse_pos.y, Number(d.x) + Number(temp_x), Number(d.y) + Number(temp_y));
                    dists.push({
                        id: this.id,
                        dist: dist
                    });
                    return 5;
                });
                dists.sort(function(a, b) {
                    return a.dist - b.dist;
                });
                target_aquired = true;
                target = dists[0].id;
                var self = d3.select("#" + dists[0].id);
                var translate = d3.transform(self.attr("transform")).translate;
            }
        }).on("mouseout", function() {
            target_aquired = false;
            if (d3.select(this).attr("class") !== "shape selected") {
                d3.select(this).select(".main").style("stroke", "#636363").style("stroke-width", 2);
            } else {}
            d3.select(this).selectAll(".link_point").style("visibility", "hidden");
        }).on("click", function(d) {
            if (d3.event.shiftKey) {
                d3.select(this).classed("selected", true);
                selected.push(d3.select(this).attr("id"));
            } else {
                d3.selectAll(".selected").select(".main").style("stroke", "#636363").style("stroke-width", 2);
                d3.selectAll(".selected").select(".table_border").style("stroke", "#636363").style("stroke-width", 2);
                d3.selectAll(".selected").classed("selected", false);
                d3.select(this).classed("selected", true);
                selected = [ d3.select(this).attr("id") ];
            }
        });
        shapeEnter.append("rect").attr("class", "resize").style("fill", "grey").style("opacity", 0).style("stroke-width", 5).style("cursor", "ew-resize").attr("x", function(d) {
            return d.width / 2 - 5;
        }).attr("y", function(d) {
            return -(d.height / 2);
        }).attr("width", 10).attr("height", function(d) {
            return d.height;
        }).call(resize_x);
        shapeEnter.append("rect").attr("class", "resize").style("fill", "grey").style("opacity", 0).style("stroke-width", 5).style("cursor", "ns-resize").attr("x", function(d) {
            return -(d.width / 2);
        }).attr("y", function(d) {
            return d.height / 2 - 5;
        }).attr("width", function(d) {
            return d.width;
        }).attr("height", 10).call(resize_y);
        shapeEnter.append("rect").attr("class", "shape_border main").attr("transform", function(d) {
            return "rotate(" + (d.subType == "diamond" ? 45 : 0) + ")";
        }).attr("x", function(d) {
            return -(d.width / 2);
        }).attr("y", function(d) {
            return -(d.height / 2);
        }).attr("rx", function(d) {
            if (d.subType == "circle") return d.width; else return 5;
        }).attr("ry", function(d) {
            if (d.subType == "circle") return d.height; else return 5;
        }).attr("width", function(d) {
            var this_width = d.subType == "text" ? d.text.length * 10 : d.width;
            return this_width;
        }).attr("height", function(d) {
            return d.height;
        }).style("cursor", "move").style("fill", function(d) {
            if (d.background_color) return d.background_color; else return "white";
        }).style("stroke", function(d) {
            if (d.color) return d.color; else return default_color;
        }).call(drag);
        shapeEnter.append("text").attr("class", "text unselectable").style("visibility", function(d) {
            if (d.subType == "text") return "visible"; else return "hidden";
        }).attr("x", function(d) {
            return -(d.width / 2) + 6;
        }).attr("y", function(d) {
            return 5;
        }).style("fill", "black").style("stroke", "none").text(function(d) {
            if (d.text) {
                return d.text + " ";
            } else return "";
        }).call(make_editable, "text");
        shapeEnter.selectAll(".link_point").data(function(d) {
            if (d.subType !== "text") return link_points.shape; else return [];
        }).enter().append("circle").attr("class", function(d) {
            return "link_point " + d.name;
        }).style("visibility", "hidden").attr("id", function(d) {
            return this.parentNode.id + "_" + d.name;
        }).attr("r", 5).attr("cx", function(d) {
            var d_o = d3.select(this.parentNode).datum().subType == "diamond" ? d3.select(this.parentNode).datum().width / 3 : 0;
            return d.position(Number(d3.select(this.parentNode).select(".main").attr("width")) + d_o, Number(d3.select(this.parentNode).select(".main").attr("height")) + d_o).x;
        }).attr("cy", function(d) {
            var d_o = d3.select(this.parentNode).datum().subType == "diamond" ? d3.select(this.parentNode).datum().height / 3 : 0;
            return d.position(Number(d3.select(this.parentNode).select(".main").attr("width")) + d_o, Number(d3.select(this.parentNode).select(".main").attr("height")) + d_o).y;
        }).on("mouseover", function(d) {
            target_aquired = true;
            target = this.id;
            d3.select(this).transition().duration(500).attr("r", 15).attr("fill", "red");
            var self = d3.select(this);
            var translate = d3.transform(self.attr("transform")).translate;
        }).on("mouseout", function() {
            target_aquired = false;
            target = "";
            d3.select(this).transition().duration(500).attr("r", 5).attr("fill", "blue");
        });
        shapeEnter.selectAll(".link_point").on("mouseup", function() {
            //  console.log("mouseup")
            dragging = false;
            d3.select(this).attr("transform", function(d, i) {
                return "translate(0,0)";
            });
        }).call(linkTables);
        shape.exit().remove();
        var shapeMove = shape.attr("transform", function(d) {
            return "translate(" + d.x + "," + d.y + ")";
        });
        shape.select(".text").text(function(d) {
            if (d.text) {
                return d.text + " ";
            } else return "";
        });
        shape.select(".main").attr("width", function(d) {
            var this_width = d.subType == "text" ? this.parentNode.getBoundingClientRect().width : d.width;
            return this_width;
        });
        var table = canvas.selectAll("g.table").data(data_obj.table);
        var tableEnter = table.enter().append("g").attr("class", "table").attr("id", function(d) {
            return d.id;
        }).attr("transform", function(d, i) {
            return "translate(" + d.x + "," + d.y + ")";
        }).on("mouseover", function(d) {
            d3.select(this).select(".table_border").transition().duration(250).style("stroke", "#2b8cbe").style("stroke-width", 5);
            d3.select(this).selectAll(".link_point").style("visibility", "visible");
            d3.select(this).select(".add_field").style("visibility", function(d1) {
                if (d1.fields.length < 10) return "visible"; else return "hidden";
            });
            d3.select(this).select(".remove_table").style("visibility", "visible");
            d3.select(this).selectAll(".key").style("visibility", "visible");
            if (dragging && !target_aquired) {
                var dists = [];
                var mouse_pos = {
                    x: (d3.event.clientX - svg_offset.x).toFixed(2),
                    y: (d3.event.clientY - svg_offset.y).toFixed(2)
                };
                d3.select(this).selectAll(".link_point").attr("r", function(d2, i) {
                    var temp_x = Number(d2.position(d3.select(this.parentNode).select(".main").attr("width"), d3.select(this.parentNode).select(".main").attr("height")).x);
                    var temp_y = Number(d2.position(d3.select(this.parentNode).select(".main").attr("width"), d3.select(this.parentNode).select(".main").attr("height")).y);
                    var dist = distance(mouse_pos.x, mouse_pos.y, Number(d.x) + Number(temp_x), Number(d.y) + Number(temp_y));
                    dists.push({
                        id: this.id,
                        dist: dist
                    });
                    return 5;
                });
                dists.sort(function(a, b) {
                    return a.dist - b.dist;
                });
                target_aquired = true;
                target = dists[0].id;
                var self = d3.select("#" + dists[0].id);
                var translate = d3.transform(self.attr("transform")).translate;
            }
        }).on("mouseout", function() {
            if (d3.select(this).attr("class") !== "table selected") {
                d3.select(this).select(".table_border").transition().duration(250).style("stroke", "#636363").style("stroke-width", 2);
            }
            d3.selectAll(".link_point").style("visibility", "hidden");
            d3.select(this).select(".add_field").style("visibility", "hidden");
            d3.select(this).select(".remove_table").style("visibility", "hidden");
            d3.select(this).selectAll(".key").style("visibility", function(d) {
                return d.primary || d.foreign ? "visible" : "hidden";
            });
            target_aquired = false;
            target = "";
        }).on("click", function(d) {
            if (d3.event.shiftKey) {
                d3.select(this).classed("selected", true);
                //d3.select(this).attr("class", "table selected");
                selected.push(d3.select(this).attr("id"));
            } else {
                d3.selectAll(".table.selected").select(".table_border.main").style("stroke", "#636363").style("stroke-width", 2);
                d3.selectAll(".shape.selected").select(".shape_border").style("stroke", "#636363").style("stroke-width", 2);
                d3.selectAll(".selected").classed("selected", false);
                //.attr("class", "table");
                d3.select(this).classed("selected", true);
                //.attr("class", "table selected");
                selected = [ d3.select(this).attr("id") ];
            }
        });
        tableEnter.append("rect").attr("class", "table_border main").style("cursor", "move").style("fill", "#e6e6e6").style("stroke", function(d) {
            if (d.color) return d.color; else return default_color;
        }).attr("x", function(d) {
            return -(d.width / 2);
        }).attr("y", function(d) {
            return -(d.height / 2);
        }).attr("rx", 5).attr("ry", 5).attr("width", function(d) {
            return d.width;
        }).attr("height", function(d) {
            return d.height;
        }).call(drag);
        tableEnter.append("rect").attr("class", "table_border resize").style("fill", "none").style("opacity", 0).style("stroke-width", 5).style("cursor", "ew-resize").attr("x", function(d) {
            return d.width / 2;
        }).attr("y", function(d) {
            return -(d.height / 2);
        }).attr("width", 5).attr("height", function(d) {
            return d.height;
        }).call(resize_x);
        tableEnter.append("rect").attr("class", "table_border resize").style("fill", "none").style("opacity", 0).style("stroke-width", 5).style("cursor", "ns-resize").attr("x", function(d) {
            return -(d.width / 2);
        }).attr("y", function(d) {
            return d.height / 2;
        }).attr("width", function(d) {
            return d.width;
        }).attr("height", 5).call(resize_y);
        tableEnter.append("rect").attr("class", "table_name_background").attr("stroke", "none").attr("fill", function(d) {
            if (d.color) return d.color; else return default_color;
        }).attr("x", function(d) {
            return -(d.width / 2);
        }).attr("y", function(d) {
            return -(d.height / 2);
        }).attr("rx", 5).attr("ry", 5).attr("width", function(d) {
            return d.width;
        }).attr("height", 20);
        tableEnter.append("rect").attr("class", "table_name").attr("fill", function(d) {
            if (d.color) return d.color; else return default_color;
        }).attr("stroke", "none").attr("x", function(d) {
            return -(d.width / 2);
        }).attr("y", function(d) {
            return -(d.height / 2) + 10;
        }).attr("width", function(d) {
            return d.width;
        }).attr("height", 20);
        tableEnter.append("text").attr("class", "name unselectable").style("fill", "white").style("text-anchor", "middle").style("font-family", "Helvetica").style("visibility", "visible").attr("x", function(d) {
            return 0;
        }).attr("y", function(d) {
            return -(d.height / 2) + 7;
        }).attr("dy", "1em").attr("width", function(d) {
            return d.width;
        }).text(function(d) {
            return d.name;
        }).call(make_editable, "name");
        tableEnter.append("svg:image").attr("class", "remove_table").style("visibility", "hidden").attr("xlink:href", "images/close.svg").attr("width", 20).attr("height", 20).attr("x", function(d) {
            return d.width / 2 - 20;
        }).attr("y", function(d) {
            return -(d.height / 2);
        }).on("click", function(d) {
            remove_object(d);
            update();
        });
        tableEnter.append("svg:image").attr("class", "add_field").style("visibility", "hidden").attr("xlink:href", "images/add.svg").attr("width", 14).attr("height", 14).attr("x", -7).attr("y", function(d) {
            return -(d.height / 2) + d.fields.length * 30;
        }).on("click", function(d) {
            d.fields.push(make_field(d.id + "_field_" + (d.fields.length + 1), "Field_" + (d.fields.length + 1), d.width - 20));
            update();
        });
        tableEnter.selectAll(".link_point").data(link_points.table).enter().append("circle").attr("class", function(d) {
            return "link_point " + d.name;
        }).style("visibility", "hidden").attr("id", function(d) {
            return this.parentNode.id + "_" + d.name;
        }).attr("r", 5).attr("cx", function(d) {
            return d.position(d3.select(this.parentNode).select(".main").attr("width"), d3.select(this.parentNode).select(".main").attr("height")).x;
        }).attr("cy", function(d) {
            return d.position(d3.select(this.parentNode).select(".main").attr("width"), d3.select(this.parentNode).select(".main").attr("height")).y;
        }).on("mouseover", function(d) {
            target_aquired = true;
            target = this.id;
            d3.select(this).transition().duration(500).attr("r", 15).attr("fill", "red");
            var self = d3.select(this);
            var translate = d3.transform(self.attr("transform")).translate;
        }).on("mouseout", function() {
            target_aquired = false;
            target = "";
            d3.select(this).transition().duration(500).attr("r", 5).attr("fill", "blue");
        });
        tableEnter.selectAll(".link_point").on("mouseup", function() {
            //  console.log("mouseup")
            dragging = false;
            d3.select(this).attr("transform", function(d, i) {
                return "translate(0,0)";
            });
        }).call(linkTables);
        //.on("mousedown", function(){linkTables(this);})
        table.exit().remove();
        var tableMove = table.attr("transform", function(d) {
            return "translate(" + d.x + "," + d.y + ")";
        });
        var table_nameUpdate = table.select(".name").text(function(d) {
            return d.name;
        });
        var field_add_move = table.select(".add_field").attr("y", function(d) {
            return -(d.height / 2) + 35 + d.fields.length * 20;
        });
        d3.selectAll(".fields").remove();
        var fields = table.selectAll("fields").data(function(d) {
            return d.fields;
        });
        var fieldsEnter = fields.enter().append("g").attr("transform", function(d, i) {
            return "translate(" + (-(d3.select(this.parentNode).select(".main").attr("width") / 2) + 5) + "," + (-(d3.select(this.parentNode).select(".main").attr("height") / 2) + 40 + i * 20) + ")";
        }).style("visibility", function(d, i) {
            if (d3.select(this.parentNode).select(".main").attr("height") > 50 + i * 20) return "visible"; else return "hidden";
        });
        fieldsEnter.append("text").attr("class", "fields unselectable").attr("dy", "1em").style("stroke", "none").style("fill", "black").style("font-family", "Helvetica").text(function(d) {
            return d.name;
        }).call(make_editable, "name");
        fieldsEnter.append("svg:image").attr("class", "key fields").attr("xlink:href", "images/key.svg").attr("x", function(d) {
            return d3.select(this.parentNode.parentNode).select(".main").attr("width") - 30;
        }).attr("width", 15).attr("height", 15).style("visibility", function(d, i) {
            if (d3.select(this.parentNode.parentNode).select(".main").attr("height") > 50 + i * 20) return d.primary || d.foreign ? "visible" : "hidden"; else return "hidden";
        }).style("stroke", "none").style("opacity", function(d) {
            return d.primary || d.foreign ? 1 : .4;
        }).style("cursor", "pointer").on("click", function(d) {
            d.primary = d.primary ? false : true;
            update();
        });
        fields.exit().remove();
        if (convert_line_to_link !== null) {
            line_to_link(convert_line_to_link);
            remove_object(convert_line_to_link);
            convert_line_to_link = null;
            update();
        }
    }
    function remove_object(d) {
        console.log("removing : " + d.type + "  " + d.id);
        console.log("before  : " + d.type + " amount : " + data_obj[d.type].length);
        data_obj[d.type] = data_obj[d.type].filter(function(obj) {
            return obj.id !== d.id;
        });
        data_obj.link = data_obj.link.filter(function(obj) {
            return obj.id.indexOf(d.id) == -1;
        });
        if (data_obj.link_list[d.id]) delete data_obj.link_list[d.id];
        var to_delete = [];
        /************************ This is too complex! *************/
        for (o in data_obj.link_list) {
            for (l in data_obj.link_list[o]) {
                if (data_obj.link_list[o][l].from.indexOf(d.id) !== -1 || data_obj.link_list[o][l].to.indexOf(d.id) !== -1) to_delete.push({
                    o: o,
                    l: l
                });
            }
        }
        for (del in to_delete) {
            delete data_obj.link_list[to_delete[del].o][to_delete[del].l];
        }
        d3.selectAll("#" + d.id).remove();
        console.log("after : " + d.type + " amount : " + data_obj[d.type].length);
        console.log("**************");
    }
    function distance(x1, y1, x2, y2) {
        var a = Math.abs(x1 - x2);
        var b = Math.abs(y1 - y2);
        return Math.sqrt(a * a + b * b);
    }
    function update_users() {
        canvas.selectAll(".other_user").remove();
        var cursors = canvas.selectAll(".other_user").data(users);
        var cursorEnter = cursors.enter().append("g").attr("class", "other_user").attr("id", function(d) {
            return d.user;
        }).attr("transform", function(d) {
            return "translate(" + d.x + "," + d.y + ")";
        }).style("visibility", function(d) {
            return d.active ? "visible" : "hidden";
        });
        cursorEnter.append("svg:image").attr("xlink:href", "images/cursor.svg").attr("width", 20).attr("height", 20);
        cursorEnter.append("text").text(function(d) {
            return d.name;
        });
        var cursorUpdate = cursors.attr("transform", function(d) {
            return "translate(" + d.x + "," + d.y + ")";
        });
    }
    function capitalize(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
    d3.selection.prototype.moveToFront = function() {
        return this.each(function() {
            this.parentNode.appendChild(this);
        });
    };
    /**
     * detect IE
     * returns version of IE or false, if browser is not Internet Explorer
     */
    function msieversion() {
        var ua = window.navigator.userAgent;
        var msie = ua.indexOf("MSIE ");
        if (msie > 0) {
            // IE 10 or older => return version number
            return parseInt(ua.substring(msie + 5, ua.indexOf(".", msie)), 10);
        }
        var trident = ua.indexOf("Trident/");
        if (trident > 0) {
            // IE 11 => return version number
            var rv = ua.indexOf("rv:");
            return parseInt(ua.substring(rv + 3, ua.indexOf(".", rv)), 10);
        }
        var edge = ua.indexOf("Edge/");
        if (edge > 0) {
            // Edge (IE 12+) => return version number
            return parseInt(ua.substring(edge + 5, ua.indexOf(".", edge)), 10);
        }
        // other browser
        return false;
    }
    function showTooltip(text) {
        tooltip.html(text);
        var x = d3.event.pageX, y = d3.event.pageY;
        var tt_size = tooltip.node().getBoundingClientRect();
        var tooltip_offset_x = x > tt_size.width ? -(tt_size.width / 2) : tt_size.width / 2;
        var tooltip_offset_y = y > tt_size.height + 40 ? -(tt_size.height + 40) : 30;
        tooltip.style("visibility", "visible").style("left", x + tooltip_offset_x + "px").style("top", y + tooltip_offset_y + "px");
    }
    function make_editable(d, field) {
        this.on("mouseover", function() {
            d3.select(this).style("fill", "red");
        }).on("mouseout", function() {
            if (d3.select(this).attr("class") == "name unselectable") text_color = "white"; else text_color = "black";
            d3.select(this).style("fill", text_color);
        }).on("click", function(d) {
            var top = window.pageYOffset || document.documentElement.scrollTop, left = window.pageXOffset || document.documentElement.scrollLeft;
            var p = this.parentNode;
            var xy = this.getBoundingClientRect();
            //.getBBox();
            var p_xy = p.getBoundingClientRect();
            //.getBBox();
            var w_p = p_xy.width > 100 ? p_xy.width : 100;
            var el = d3.select(this);
            var p_el = d3.select(p);
            var frm = d3.select("body").append("div").style("position", "absolute");
            //.attr("class", "editable");
            var inp = frm.style("left", left + xy.left - 2 + "px").style("top", top + xy.top - 53 + "px").append("xhtml:form").append("input").attr("class", "diagram_form").style("border", "0").style("padding", "0").style("background-color", "red !important").attr("value", function() {
                this.focus();
                return d[field];
            }).attr("style", "width:" + 100 + "px;").on("blur", function() {
                console.log("blur");
                var txt = inp.node().value;
                d[field] = txt;
                el.text(function(d) {
                    return d[field];
                });
                update();
                frm.remove();
            }).on("keypress", function() {
                // IE fix
                if (!d3.event) d3.event = window.event;
                var e = d3.event;
                if (e.keyCode == 13) {
                    //console.log("enter pressed!!")
                    if (typeof e.cancelBubble !== "undefined") // IE
                    e.cancelBubble = true;
                    if (e.stopPropagation) e.stopPropagation();
                    e.preventDefault();
                    var txt = inp.node().value;
                    d[field] = txt;
                    console.log(d3.select(this).style("width"));
                    //.replace.attr("style", "width:"+(100)+"px;")
                    el.text(function(d) {
                        return d[field];
                    });
                    frm.remove();
                    update();
                    return "done";
                } else {
                    // REsize the form to fit the text //
                    var this_width = Number(d3.select(this).style("width").replace("px", ""));
                    if (inp.node().value.length > 10) {
                        this_width = inp.node().value.length * 9 + 5;
                        d3.select(this).style("width", this_width + "px");
                    }
                }
            });
        });
    }
}