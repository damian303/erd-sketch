var data = JSON.parse(data.replace(/&quot;/g,'"'));
var data_scale = d3.scaleLinear().domain([0, 100]).range([0, data.length]);
var colors={}, c = 0, testers = [];
data.forEach(function(d){
	if(!colors[d.username]){
		colors[d.username]=d3.schemeCategory10[c];
		testers.push({'name':d.username, 'tester':'Tester '+(c+1), 'color':d3.schemeCategory10[c]})
		c++;
	}
});
console.log(colors);
var info = d3.select('#info').style("width", "200px").selectAll(".tester")
	 .data(testers)
	 .enter().append("div")
	 .attr("class", "tester")
	 .style("width", "20px")
	 .style("height", "20px")
	 .style("opacity", ".7")
	 .style("background", function(d){return d.color;})
	 .append("div")
	 .style("margin-left", "25px")
	 .style("opacity", "1")
	 .html(function(d){return d.name;})

var slider = document.getElementById('slider');
	slider.style.width = '50%';
	slider.style.margin = '0 auto 30px';
	
noUiSlider.create(slider, {
	start: [0, 100],
	connect: true,
	steps:1,
	range: {
		'min': 0,
		'max': 100
	}
});
slider.noUiSlider.on('update', function( values, handle ) {
	draw(data.slice(Math.floor(data_scale(values[0])), Math.floor(data_scale(values[1]))));
})
//console.log(data)
$(function() { draw(data)});
function draw(data){
	console.log(data.length)
	var w= 960, h = 500;

		d3.select("#svg").html("");

	var svg = d3.select("#svg").append("svg")
		.style("height", h)
		.style("width", w);

	var margin = {top: 20, right: 80, bottom: 30, left: 50},
	    width = w - margin.left - margin.right,
	    height = h - margin.top - margin.bottom,
	    g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

	var parseTime = d3.timeParse("%Y%m%d");

	var x = d3.scaleLinear().range([0, width]),
	    y = d3.scaleLinear().range([height, 0]),
	    z = d3.scaleOrdinal(d3.schemeCategory10);

	var line = d3.line()
	    .curve(d3.curveBasis)
	    .x(function(d) { return x(d.date); })
	    .y(function(d) { return y(d.updates); });

	var area = d3.area()
		.x(function(d) { return x(d.date); })
		.y0(height)
		.y1(function(d) { return y(d.updates); })
		.curve(d3.curveMonotoneX);

	var user_obj = {};
	var maxUpdates = 0;
	data.forEach(function(d){
	  	if(d.username!=='Trial_User'&&d.username!=null){
	  		if(!user_obj[d.username])user_obj[d.username] = {'id':d.username, total:0, working:0, values:[]};
	  		user_obj[d.username].values.push({'date':+d.timeStamp, 'updates':+d.updates});
	  		user_obj[d.username].total+=d.updates;
	  		if(d.updates!==0)user_obj[d.username].working++;
	  	}
	});

	var users = [];

	for (var u in user_obj) {
		if (user_obj.hasOwnProperty(u)) {
			user_obj[u].values.sort(function(a,b){return a.date<b.date ? -1 : a.date>b.date ? 1 : 0;});	
		    users.push(user_obj[u]);
		    console.log(u+" total updates : "+user_obj[u].total)
		    console.log(u+" time taken : "+(Math.abs(user_obj[u].values[user_obj[u].values.length-1].date - user_obj[u].values[0].date))/60)
		    console.log(u+" working minutes : "+user_obj[u].working)
		}

	}

	  x.domain(d3.extent(data, function(d) { return d.timeStamp; }));

	  y.domain(d3.extent(data, function(d) { return d.updates; }));

	  z.domain(users.map(function(c) { return c.id; }));

	  g.append("g")
	      .attr("class", "axis axis--x")
	      .attr("transform", "translate(0," + height + ")")
	      .call(d3.axisBottom(x)
	      	.ticks(10)
			.tickFormat(function(d){
				var date = new Date(d*1000);
				return date.getHours()+":"+(date.getMinutes()<10?"0":"")+date.getMinutes();
			})
	      );

	  g.append("g")
	      .attr("class", "axis axis--y")
	      .call(d3.axisLeft(y))
	    .append("text")
	      .attr("transform", "rotate(-90)")
	      .attr("y", 6)
	      .attr("dy", "0.71em")
	      .attr("fill", "#000")
	      .text("updates");

	  var user = g.selectAll(".user")
	    .data(users)
	    .enter().append("g")
	      .attr("class", "user");

	  user.append("path")
	      .attr("class", "line")
	      .attr("d", function(d) { return area(d.values); })
	      .style("stroke", function(d) { return colors[d.id]; })
	      .style("fill-opacity", .5)
	      .style("fill", function(d) { return colors[d.id]; });
/*
	  user.selectAll(".circle")
			.data(function(d){return d.values;})
			.enter()
			.append("circle")
			.attr("class", "circle")
			.attr("r", 10)
			.attr("cx", function(d) { return x(d.date); })
			.attr("cy", function(d) { return y(d.updates); })
			.style("stroke", function(d) { return z(d.id); })
			.style("fill-opacity", .9)
			.style("fill", function(d) { return "red"; });

	  user.append("text")
	      .datum(function(d) { return {id: d.id, value: d.values[d.values.length - 1]}; })
	      .attr("transform", function(d) { return "translate(" + x(d.value.date) + "," + y(d.value.updates) + ")"; })
	      .attr("x", 3)
	      .attr("dy", "0.35em")
	      .style("font", "10px sans-serif")
	      .text(function(d) { return d.id; });
*/

};