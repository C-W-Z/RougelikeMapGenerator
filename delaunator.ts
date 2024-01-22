/* reference: https://openhome.cc/Gossip/P5JS/Delaunay.html */

// 三角形 triangle = [Vec1, Vec2, Vec3]
// 三個頂點以逆時針排序
// Vec1 對面的邊就是 Ve2 和 Ve3 連線的邊 Vec2-Vec3
// Vec1 面對的三角形就是和 triangle 共用 Vec2-Vec3 這條邊的另一個三角形

function circumcircle(triangle: Vec[]) {
    const [p1, p2, p3] = triangle;
    const v1 = Vec.sub(p2, p1);
    const v2 = Vec.sub(p3, p2);
    const d1 = Vec.add(p2, p1).mult(0.5).dot(v1);
    const d2 = Vec.add(p3, p2).mult(0.5).dot(v2);
    const det = -Vec.cross(v1, v2).z;
    if (det !== 0) {
        const x = (d2 * v1.y - d1 * v2.y) / det;
        const y = (d1 * v2.x - d2 * v1.x) / det;
        const center = new Vec(x, y);
        const v = Vec.sub(p1, center);
        const radius = v.mag();
        const rr = v.sqrMag();
        return { center, radius, rr };
    }
    return null;
}

class Delaunator {
    private coords: Vec[];
    private oppoTriangles: Map<number[], (number[] | null)[]>;
    private circumcircles: Map<number[], { center: Vec, radius: number, rr: number } | null>;
    constructor(width: number, height: number) {
        const center = new Vec(width / 2, height / 2);
        const halfSize = Math.max(width, height) * 10;
        // 建立一個比畫布大上許多的正方形
        this.coords = [
            Vec.add(center, new Vec(-halfSize, -halfSize)),
            Vec.add(center, new Vec(-halfSize, halfSize)),
            Vec.add(center, new Vec(halfSize, halfSize)),
            Vec.add(center, new Vec(halfSize, -halfSize))
        ];
        // 將正方形分為兩個三角形，0 和 2 的對面剛好是共用邊 1-3
        // 0 3
        // 1 2
        const t1 = [0, 1, 3];
        const t2 = [2, 3, 1];

        // [三角形頂點索引] => [頂點 0 面對的三角形, 頂點 1 面對的三角形, 頂點 2 面對的三角形]（也就是這個清單包含鄰接三角形）
        this.oppoTriangles = new Map();
        // [三角形頂點索引] => 外接圓
        this.circumcircles = new Map();

        // 設定初始的兩個三角形
        // t1 頂點 0 面對 t2，另兩個頂點沒有面對的三角形
        this.oppoTriangles.set(t1, [t2, null, null]);
        // t2 頂點 0 面對 t1，另兩個頂點沒有面對的三角形
        this.oppoTriangles.set(t2, [t1, null, null]);

        // 設定初始的兩個外接圓
        this.circumcircles.set(t1, circumcircle(t1.map(i => this.coords[i])));
        this.circumcircles.set(t2, circumcircle(t2.map(i => this.coords[i])));
    }
    private inCircumcircle(point: Vec, triangle: number[]) {
        const c = this.circumcircles.get(triangle);
        if (!c) {
            console.error("Not found ", triangle, " in ", this.circumcircles);
            return false;
        }
        // 以半徑平方比較
        const rr = Vec.sub(c.center, point).sqrMag();
        return rr <= c.rr;
    }
    private findBadTriangles(point: Vec) {
        // 從 triangles 裡找出外接圓有包含 point 點的所有三角形
        return Array.from(this.oppoTriangles.keys())
            .filter(tri => this.inCircumcircle(point, tri));
    }
    private findBoundary(badTriangles: number[][]) {
        const boundary: { edge: number[], delaunayTri: number[] | null }[] = [];

        // 從任一不合格三角形 t 開始尋找邊，這邊從 0 開始
        let t = badTriangles[0];

        // vi 是用來走訪鄰接三角形的索引
        let vi = 0;
        while (true) {
            // 取得不合格三角形 t 第 vi 頂點面對的三角形 opTri
            const badT = this.oppoTriangles.get(t);
            if (!badT) {
                console.error("Not found ", t, " in ", this.oppoTriangles);
                break;
            }
            const opTri = badT[vi];
            // 如果 opTri 是合格三角形
            if (badTriangles.find(tri => tri === opTri) === undefined) {
                boundary.push({
                    // 記錄 vi 在 t 中面對的邊的索引，這邊有處理循環與負索引
                    edge: [t[(vi + 1) % 3], t[vi > 0 ? vi - 1 : (t.length + vi - 1)]],
                    // edge: [t[(vi + 1) % 3], t[(vi + 2) % 3]],
                    // 記錄第 vi 頂點面對的三角形（目前是合格的 delaunay 三角形）         
                    delaunayTri: opTri
                });
                // 下個頂點索引
                vi = (vi + 1) % 3;
                // 邊頂點索引有相接了，表示繞行不合格的三角形們一圈了
                if (boundary[0].edge[0] === boundary[boundary.length - 1].edge[1])
                    break;
            }
            // 如果 opTri 也是不合格三角形，不收集邊
            else {
                if (!opTri) {
                    console.error("Not found opposite Triangle of ", vi, " in ", badT);
                    break;
                }
                // 找到 t 和 opTri 共用邊面對的 opTri 的那個頂點
                const i = this.oppoTriangles.get(opTri)?.findIndex(tri => tri === t);
                if (i === undefined) {
                    console.error("Not found the point opposite to ", vi, " of ", t, " in ", opTri);
                    break;
                }
                // 下個頂點索引
                vi = (i + 1) % 3;
                // opTri 也是不合格三角形，用它繼續尋找邊
                t = opTri;
            }
        }
        return boundary;
    }
    private adjustNeighbors(newTriangles: { t: number[], edge: number[], delaunayTri: number[] | null }[]) {
        for (let i = 0; i < newTriangles.length; i++) {
            const { t, edge, delaunayTri } = newTriangles[i];
            // 新三角形 t，先記錄它對其中一個鄰居 delaunayTri 的關係
            this.oppoTriangles.set(t, [delaunayTri, null, null]);
            this.circumcircles.set(t, circumcircle(t.map(i => this.coords[i]))); // 新外接圓

            // 設定 delaunayTri 與新三角形 t 的鄰居關係
            if (delaunayTri !== null) {
                // delaunayTri 的舊鄰居，其中包含了被刪除的不合格三角形
                const neighbors = this.oppoTriangles.get(delaunayTri);
                if (!neighbors) {
                    console.error("Not found neigbors of ", delaunayTri, " in ", this.oppoTriangles);
                    break;
                }
                for (let i = 0; i < neighbors.length; i++) {
                    const neighbor = neighbors[i];
                    // 如果找到原本不合格三角形的邊了
                    if (neighbor !== null && neighbor.includes(edge[1]) && neighbor.includes(edge[0])) {
                        // t 是 delaunayTri 在 edge 邊上的新鄰居
                        neighbors[i] = t;
                        break;
                    }
                }
            }
        }

        // 設定新三角形與其他三角形的鄰接關係
        for (let i = 0; i < newTriangles.length; i++) {
            const t = newTriangles[i].t;
            const opTri = this.oppoTriangles.get(t);
            if (!opTri) {
                console.error("Not found oppo Triangle of ", t, " in ", this.oppoTriangles);
                break;
            }
            opTri[1] = newTriangles[(i + 1) % newTriangles.length].t;
            opTri[2] = newTriangles[i > 0 ? i - 1 : newTriangles.length + i - 1].t;
        }
    }
    addPoint(point: Vec) {
        // 新頂點的index，先保留，後續要建立新三角形時使用
        const idx = this.coords.length;
        // 加入新頂點
        this.coords.push(point);
        // 已有的三角形外接圓若包含point，就放進badTriangles裡
        const badTriangles = this.findBadTriangles(point);
        // 找出不合格三角形的邊，但不包含他們的共用邊
        const boundary = this.findBoundary(badTriangles);
        // 刪除不合格的三角形以及外接圓
        badTriangles.forEach(tri => {
            this.oppoTriangles.delete(tri);
            this.circumcircles.delete(tri);
        });
        // 用收集的邊建立新三角形
        const newTriangles = boundary.map(b => {
            return {
                t: [idx, b.edge[0], b.edge[1]],  // 新三角形
                edge: b.edge,                    // 用哪個邊建立
                delaunayTri: b.delaunayTri       // 共用該邊的三角形（目前是合格的 delaunay 三角形）
            };
        });
        // 調整三角形間的鄰接關係
        this.adjustNeighbors(newTriangles);
    }
    // 三角形頂點索引
    indicesOfTriangles() {
        return Array.from(this.oppoTriangles.keys())
            .filter(tri => tri[0] > 3 && tri[1] > 3 && tri[2] > 3)
            .map(tri => [tri[0] - 4, tri[1] - 4, tri[2] - 4]);
    }
    // 三角形頂點座標
    pointsOfTriangles() {
        return Array.from(this.oppoTriangles.keys())
            .filter(tri => tri[0] > 3 && tri[1] > 3 && tri[2] > 3)
            .map(tri => [this.coords[tri[0]], this.coords[tri[1]], this.coords[tri[2]]]);
    }
}

const CANVAS_SIZE: number = 500;
const canvas = <HTMLCanvasElement>document.getElementById("canvas");
canvas.height = CANVAS_SIZE;
canvas.width = CANVAS_SIZE;
const ctx = canvas.getContext('2d');

const points: Vec[] = [];
let delaunay = new Delaunator(CANVAS_SIZE, CANVAS_SIZE);

function draw() {
    if (!ctx) return;

    ctx.fillStyle = "#eeeeee";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    delaunay.pointsOfTriangles().forEach(triangle => {
        drawLine(ctx, triangle[0], triangle[1], "black", 1);
        drawLine(ctx, triangle[1], triangle[2], "black", 1);
        drawLine(ctx, triangle[2], triangle[0], "black", 1);
    });

    points.forEach(p => drawCircle(ctx, p, 2, "black"));
}

canvas.onmousedown = (e) => {
    const p = getMousePos(canvas, e);
    points.push(p);
    delaunay.addPoint(p);
    draw();
}

if (ctx) {
    ctx.fillStyle = "#eeeeee";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
}