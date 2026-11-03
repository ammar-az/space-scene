/** Compile/link with complete cleanup on either shader's failure. */
export function createWebGLProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string) {
    const shaders: WebGLShader[] = [];
    let program: WebGLProgram | null = null;
    try {
        for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]] as const) {
            const shader = gl.createShader(type);
            if (!shader) throw new Error("Shader allocation failed");
            shaders.push(shader);
            gl.shaderSource(shader, source); gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "Shader compilation failed");
        }
        program = gl.createProgram();
        if (!program) throw new Error("Program allocation failed");
        for (const shader of shaders) gl.attachShader(program, shader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "Shader linking failed");
        return program;
    } catch (error) {
        if (program) gl.deleteProgram(program);
        throw error;
    } finally {
        for (const shader of shaders) gl.deleteShader(shader);
    }
}
