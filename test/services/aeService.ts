
declare const __adobe_cep__: any;

export const applyToAE = (outInfluence: number, inInfluence: number): Promise<string> => {
  return new Promise((resolve) => {
    // AE script values must be between 0.1 and 100
    const out = Math.max(0.1, Math.min(100, outInfluence));
    const inf = Math.max(0.1, Math.min(100, inInfluence));
    
    const script = `applySpeedGraph(${inf}, ${out})`;
    
    if (typeof __adobe_cep__ !== 'undefined') {
      try {
        const csInterface = new (window as any).CSInterface();
        csInterface.evalScript(script, (result: string) => {
          if (result === "Eval Script Error." || (result && result.indexOf("ERROR") !== -1)) {
              resolve(result || "Script Error");
          } else {
              resolve("SUCCESS");
          }
        });
      } catch (e) {
        console.error("CEP Call Error:", e);
        resolve("Interface Error");
      }
    } else {
      console.log("Mocking AE Call:", script);
      setTimeout(() => resolve("SUCCESS"), 500);
    }
  });
};
