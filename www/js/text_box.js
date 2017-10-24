function make_editable(d, field)
{
    //console.log("make_editable", arguments);

    this
      .on("mouseover", function() {
        d3.select(this).style("fill", "red");
      })
      .on("mouseout", function() {
        d3.select(this).style("fill", null);
      })
      .on("click", function(d) {
        var p = this.parentNode;
				//console.log("Clicked !!!")
        //console.log(this, arguments);

        // inject a HTML form to edit the content here...

        // bug in the getBBox logic here, but don't know what I've done wrong here;
        // anyhow, the coordinates are completely off & wrong. :-((
        var xy = this.getBBox();
        var p_xy = p.getBBox();

      //  xy.x -= Math.abs(p_xy.x - xy.x);
        //xy.y -= Math.abs(p_xy.y - xy.y);
        /*if(d.width){
          xy.x -= d.width / 4;
        }*/
        var w_p = (p_xy.width>100)?p_xy.width:100;
        console.log("p width "+w_p)
        var el = d3.select(this);
        var p_el = d3.select(p);

        var frm = p_el.append("foreignObject");
console.log("d width "+d.width)
console.log(d);
        var inp = frm
            .attr("x", xy.x-(0))
            .attr("y", xy.y-4)
            .attr("width", 100)//xy.width)
            .attr("height", "1.2em")
            .append("xhtml:form")
                    .append("input")
                        .attr("value", function() {
                            this.focus();
                            return d[field];
                        })
                        .attr("style", "width:"+(100)+"px;")
                        // make the form go away when you jump out (form looses focus) or hit ENTER:
                        .on("blur", function() {

                            var txt = inp.node().value;

                            d[field] = txt;
                            el
                                .text(function(d) { return d[field]; });

                            // Note to self: frm.remove() will remove the entire <g> group! Remember the D3 selection logic!
                            p_el.select("foreignObject").remove();
                        })
                        .on("keypress", function() {
                            // IE fix
                            if (!d3.event)
                                d3.event = window.event;
                            var e = d3.event;
                            if (e.keyCode == 13)
                            {
                                if (typeof(e.cancelBubble) !== 'undefined') // IE
                                  e.cancelBubble = true;
                                if (e.stopPropagation)
                                  e.stopPropagation();
                                e.preventDefault();
                                var txt = inp.node().value;

                                d[field] = txt;
                                el
                                    .text(function(d) { return d[field]; });
                                    socket.emit('update_svg', {user:user_id, data:data_obj});
                                    return "done";
                                // odd. Should work in Safari, but the debugger crashes on this instead.
                                // Anyway, it SHOULD be here and it doesn't hurt otherwise.
                                p_el.select("foreignObject").remove();
                            }
                        });
      });
}
