const ol = require('ol');
const olProj = require('ol/proj');
const olTilegrid = require('ol/tilegrid');

var baiduResolutions = [];
for (var i = 0; i < 19; i++) {
    baiduResolutions[i] = Math.pow(2, 18 - i);
}
var baiduTileGrid = new olTilegrid.TileGrid({
    origin: [0, 0],
    resolutions: baiduResolutions
});

const beijing = olProj.fromLonLat([116.3974, 39.9093]);
const z = 10;
const tileCoord = baiduTileGrid.getTileCoordForCoordAndZ(beijing, z);
console.log('Beijing TileCoord at z=10:', tileCoord);
